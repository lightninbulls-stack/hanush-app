const API = "https://hanush-backend-service1.onrender.com";

export async function createOrder() {
  const res = await fetch(`${API}/cashfree/create-order`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`
    }
  });

  return res.json();
}
