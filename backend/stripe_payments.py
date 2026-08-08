"""Stripe iDEAL payments for Zoho Books invoices.
Flow:
  1. Portal client clicks "Betaal Nu" on an unpaid invoice → frontend POSTs {invoice_id, origin_url}
  2. Backend fetches invoice from Zoho Books, creates a Stripe Checkout Session
     with payment_method_types=['ideal','card'], amount in EUR, metadata={invoice_id, org_id}
  3. Record `payment_transactions` row (session_id, invoice_id, amount, status=initiated)
  4. On success (webhook `checkout.session.completed` OR status-poll fallback), mark
     the Zoho Books invoice as paid via POST /invoices/{id}/payments
  5. Status endpoint (`GET /api/payments/status/{session_id}`) polled from success page.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
import stripe
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
BOOKS_ORG_ID = os.environ.get("ZOHO_BOOKS_ORG_ID", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
TOKEN_ENC_KEY = os.environ.get("TOKEN_ENCRYPTION_KEY", "").encode()
_cipher = Fernet(TOKEN_ENC_KEY) if TOKEN_ENC_KEY else None
ACCOUNTS = "https://accounts.zoho.eu"
BOOKS_BASE = "https://www.zohoapis.eu/books/v3"

stripe.api_key = STRIPE_SECRET_KEY


def _dec(v: str) -> str:
    return _cipher.decrypt(v.encode()).decode()


def _enc(v: str) -> str:
    return _cipher.encrypt(v.encode()).decode()


class CheckoutRequest(BaseModel):
    invoice_id: str = Field(..., min_length=1)
    origin_url: str = Field(..., min_length=1)


async def _refresh(db, user):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{ACCOUNTS}/oauth/v2/token", params={
            "refresh_token": _dec(user["refresh_token"]),
            "client_id": ZOHO_CLIENT_ID,
            "client_secret": ZOHO_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
    data = r.json()
    access = data.get("access_token")
    if not access:
        raise RuntimeError(f"Zoho refresh failed: {data}")
    await db.zoho_users.update_one({"zoho_user_id": user["zoho_user_id"]}, {"$set": {
        "access_token": _enc(access),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return access


async def _zoho(db, user, method: str, url: str, *, params=None, json=None) -> dict:
    token = _dec(user["access_token"])
    h = {"Authorization": f"Zoho-oauthtoken {token}"}
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.request(method, url, params=params, json=json, headers=h)
    if r.status_code == 401:
        token = await _refresh(db, user)
        h["Authorization"] = f"Zoho-oauthtoken {token}"
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.request(method, url, params=params, json=json, headers=h)
    if r.status_code >= 400:
        raise RuntimeError(f"Zoho {method} {url} → {r.status_code}: {r.text[:200]}")
    return r.json()


async def _mark_invoice_paid(db, invoice_id: str, session, txn: dict) -> Optional[dict]:
    """Post a payment record to Zoho Books so the invoice status flips to 'paid'."""
    if not BOOKS_ORG_ID:
        return {"skipped": "no BOOKS_ORG_ID"}
    # Use the super-admin's Zoho tokens (they authored the invoice, so they can update it)
    user = None
    async for u in db.zoho_users.find({}):
        if (u.get("email") or "").lower().strip() in {e.strip().lower() for e in os.environ.get("SUPER_ADMIN_EMAILS", "").split(",") if e.strip()}:
            user = u
            break
    if not user:
        return {"skipped": "no super-admin Zoho user"}
    try:
        inv = await _zoho(db, user, "GET", f"{BOOKS_BASE}/invoices/{invoice_id}",
                          params={"organization_id": BOOKS_ORG_ID})
        contact_id = inv["invoice"]["customer_id"]
        amount_paid = (session.get("amount_total") or txn.get("amount", 0)) / 100.0
        currency = (session.get("currency") or txn.get("currency") or "eur").upper()
        payload = {
            "customer_id": contact_id,
            "payment_mode": "stripe",
            "amount": amount_paid,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "reference_number": session.get("id", ""),
            "description": f"Stripe iDEAL/card betaling — {currency}",
            "invoices": [{"invoice_id": invoice_id, "amount_applied": amount_paid}],
        }
        res = await _zoho(db, user, "POST", f"{BOOKS_BASE}/customerpayments",
                          params={"organization_id": BOOKS_ORG_ID}, json=payload)
        logger.info(f"Zoho invoice {invoice_id} marked paid: {res.get('customerpayment', {}).get('payment_id')}")
        return res
    except Exception as e:
        logger.error(f"Failed to mark Zoho invoice {invoice_id} paid: {e}")
        return {"error": str(e)}


def _require_portal_user(request: Request) -> str:
    uid = request.session.get("portal_user_id")
    if not uid:
        raise HTTPException(401, "Not authenticated with Zoho")
    return uid


def make_router(db) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.post("/payments/invoice-checkout")
    async def checkout(request: Request):
        # Auth first (fail-closed before schema validation)
        uid = _require_portal_user(request)
        if not STRIPE_SECRET_KEY:
            raise HTTPException(503, "Stripe not configured")
        if not BOOKS_ORG_ID:
            raise HTTPException(400, "ZOHO_BOOKS_ORG_ID not configured")
        try:
            raw = await request.json()
            body = CheckoutRequest(**raw)
        except Exception:
            raise HTTPException(422, "Invalid body")
        user = await db.zoho_users.find_one({"zoho_user_id": uid})
        if not user:
            raise HTTPException(401, "Zoho account not connected")
        # Fetch invoice on behalf of the portal user
        try:
            data = await _zoho(db, user, "GET", f"{BOOKS_BASE}/invoices/{body.invoice_id}",
                               params={"organization_id": BOOKS_ORG_ID})
        except Exception as e:
            raise HTTPException(400, f"Kon factuur niet ophalen: {e}")
        inv = data.get("invoice") or {}
        balance = float(inv.get("balance") or 0)
        if balance <= 0:
            raise HTTPException(400, "Deze factuur heeft geen openstaand saldo")
        currency = (inv.get("currency_code") or "EUR").lower()
        invoice_number = inv.get("invoice_number") or body.invoice_id
        amount_cents = int(round(balance * 100))
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                payment_method_types=["ideal", "card"] if currency == "eur" else ["card"],
                line_items=[{
                    "price_data": {
                        "currency": currency,
                        "product_data": {"name": f"PearBlue factuur {invoice_number}"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }],
                success_url=f"{body.origin_url}/portal/betaling-gelukt?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{body.origin_url}/portal?payment=canceled",
                metadata={
                    "invoice_id": body.invoice_id,
                    "invoice_number": str(invoice_number),
                    "zoho_org_id": BOOKS_ORG_ID,
                    "zoho_user_id": uid,
                },
                customer_email=inv.get("email"),
            )
        except stripe.error.StripeError as e:
            raise HTTPException(500, f"Stripe checkout failed: {e.user_message or str(e)}")
        await db.payment_transactions.insert_one({
            "session_id": session.id,
            "invoice_id": body.invoice_id,
            "invoice_number": str(invoice_number),
            "amount": amount_cents,
            "currency": currency,
            "status": "initiated",
            "payment_status": "pending",
            "zoho_user_id": uid,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        return {"checkout_url": session.url, "session_id": session.id}

    @router.get("/payments/status/{session_id}")
    async def status(session_id: str):
        record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not record:
            raise HTTPException(404, "Transaction not found")
        if record.get("payment_status") != "paid":
            try:
                s = stripe.checkout.Session.retrieve(session_id)
                if s.payment_status == "paid" or s.status == "complete":
                    await db.payment_transactions.update_one(
                        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                        {"$set": {
                            "status": "completed",
                            "payment_status": "paid",
                            "stripe_payment_intent_id": s.payment_intent,
                            "updated_at": datetime.now(timezone.utc),
                        }},
                    )
                    # Trigger Zoho update (idempotent via record.mark_attempted)
                    if not record.get("zoho_marked_paid"):
                        result = await _mark_invoice_paid(db, record["invoice_id"], s.to_dict(), record)
                        await db.payment_transactions.update_one(
                            {"session_id": session_id},
                            {"$set": {"zoho_marked_paid": True, "zoho_result": result}},
                        )
                    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            except stripe.error.StripeError:
                pass
        return {
            "session_id": record["session_id"],
            "status": record["status"],
            "payment_status": record["payment_status"],
            "invoice_number": record.get("invoice_number"),
            "amount": record.get("amount"),
            "currency": record.get("currency"),
        }

    @router.post("/stripe/webhook")
    async def webhook(request: Request):
        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")
        try:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(400, "Invalid signature")
        obj, t = event["data"]["object"], event["type"]
        session_id = obj.get("id")
        if t == "checkout.session.completed":
            record = await db.payment_transactions.find_one({"session_id": session_id})
            if record and record.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "status": "completed",
                        "payment_status": obj.get("payment_status", "paid"),
                        "stripe_payment_intent_id": obj.get("payment_intent"),
                        "updated_at": datetime.now(timezone.utc),
                    }},
                )
                if not record.get("zoho_marked_paid"):
                    result = await _mark_invoice_paid(db, record["invoice_id"], obj, record)
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"zoho_marked_paid": True, "zoho_result": result}},
                    )
        elif t == "checkout.session.async_payment_succeeded":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}},
            )
        elif t == "checkout.session.async_payment_failed":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "failed", "payment_status": "failed", "updated_at": datetime.now(timezone.utc)}},
            )
        elif t == "checkout.session.expired":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "expired", "payment_status": "expired", "updated_at": datetime.now(timezone.utc)}},
            )
        return {"status": "ok"}

    return router
