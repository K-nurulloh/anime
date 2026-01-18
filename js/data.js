const PRODUCTS_URL = "./products.json";

const fetchProducts = async () => {
  const response = await fetch(PRODUCTS_URL);
  if (!response.ok) {
    throw new Error("Mahsulotlar yuklanmadi");
  }
  return response.json();
};

const findProductById = (products, id) =>
  products.find((product) => String(product.id) === String(id));

const getCategories = (products) => {
  const categories = new Set(products.map((product) => product.category));
  return ["Barchasi", ...categories];
};

const formatPrice = (price) =>
  new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
    maximumFractionDigits: 0,
  }).format(price);

export { fetchProducts, findProductById, getCategories, formatPrice };
