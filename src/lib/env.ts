export const env = {
  dataMode: (process.env.DATA_MODE ?? "mock").toLowerCase(),
  pokemonTcgApiKey: process.env.POKEMON_TCG_API_KEY,
  ebayClientId: process.env.EBAY_CLIENT_ID,
  ebayClientSecret: process.env.EBAY_CLIENT_SECRET,
  ebayMarketplaceId: process.env.EBAY_MARKETPLACE_ID ?? "EBAY_US"
};

export function isMockMode() {
  return env.dataMode !== "live";
}
