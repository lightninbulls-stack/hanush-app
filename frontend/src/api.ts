// add this inside fetchStocksByCategory condition
if (category === "Sectoral Indices Performance") {
  window.localStorage.removeItem(getCacheKey(category));
  const response = await axios.get(
    `${API_BASE_URL}/portfolio/universe/sectoral-indices-performance?t=${Date.now()}`,
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }
  );
  return normalizeResponse(response.data, category);
}