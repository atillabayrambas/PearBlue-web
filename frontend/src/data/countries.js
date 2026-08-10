// Address country + region mapping used by portal registration form and user
// details editor. Each country lists its most common admin regions/provinces.
// Emojis are 🇳🇱 etc. rendered inline in the option label.
export const COUNTRIES = [
  {
    code: "NL",
    flag: "🇳🇱",
    nl: "Nederland",
    en: "Netherlands",
    regions: [
      "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen",
      "Limburg", "Noord-Brabant", "Noord-Holland", "Overijssel",
      "Utrecht", "Zeeland", "Zuid-Holland",
    ],
  },
  {
    code: "BE",
    flag: "🇧🇪",
    nl: "België",
    en: "Belgium",
    regions: [
      "Antwerpen", "Limburg", "Oost-Vlaanderen", "West-Vlaanderen",
      "Vlaams-Brabant", "Waals-Brabant", "Henegouwen", "Luik",
      "Luxemburg", "Namen", "Brussels Hoofdstedelijk Gewest",
    ],
  },
  {
    code: "DE",
    flag: "🇩🇪",
    nl: "Duitsland",
    en: "Germany",
    regions: [
      "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
      "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
      "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
      "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
    ],
  },
  {
    code: "FR",
    flag: "🇫🇷",
    nl: "Frankrijk",
    en: "France",
    regions: [
      "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
      "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
      "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
      "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
    ],
  },
  {
    code: "GB",
    flag: "🇬🇧",
    nl: "Verenigd Koninkrijk",
    en: "United Kingdom",
    regions: ["England", "Scotland", "Wales", "Northern Ireland"],
  },
  {
    code: "US",
    flag: "🇺🇸",
    nl: "Verenigde Staten",
    en: "United States",
    regions: [], // free-text
  },
  {
    code: "OTHER",
    flag: "🌍",
    nl: "Ander land",
    en: "Other country",
    regions: [],
  },
];

export const findCountry = (code) => COUNTRIES.find((c) => c.code === code) || null;
