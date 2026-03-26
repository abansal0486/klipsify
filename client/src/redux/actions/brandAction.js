import api from "../../api/axios";
import { toast } from "react-toastify";

export const FETCH_BRANDS_REQUEST = "FETCH_BRANDS_REQUEST";
export const FETCH_BRANDS_SUCCESS = "FETCH_BRANDS_SUCCESS";
export const FETCH_BRANDS_FAIL    = "FETCH_BRANDS_FAIL";

export const CREATE_BRAND_REQUEST = "CREATE_BRAND_REQUEST";
export const CREATE_BRAND_SUCCESS = "CREATE_BRAND_SUCCESS";
export const CREATE_BRAND_FAIL    = "CREATE_BRAND_FAIL";

export const UPDATE_BRAND_REQUEST = "UPDATE_BRAND_REQUEST";
export const UPDATE_BRAND_SUCCESS = "UPDATE_BRAND_SUCCESS";
export const UPDATE_BRAND_FAIL    = "UPDATE_BRAND_FAIL";

export const DELETE_BRAND_REQUEST = "DELETE_BRAND_REQUEST";
export const DELETE_BRAND_SUCCESS = "DELETE_BRAND_SUCCESS";
export const DELETE_BRAND_FAIL    = "DELETE_BRAND_FAIL";

export const ADD_PRODUCT_REQUEST    = "ADD_PRODUCT_REQUEST";
export const ADD_PRODUCT_SUCCESS    = "ADD_PRODUCT_SUCCESS";
export const ADD_PRODUCT_FAIL       = "ADD_PRODUCT_FAIL";

export const UPDATE_PRODUCT_REQUEST = "UPDATE_PRODUCT_REQUEST";
export const UPDATE_PRODUCT_SUCCESS = "UPDATE_PRODUCT_SUCCESS";
export const UPDATE_PRODUCT_FAIL    = "UPDATE_PRODUCT_FAIL";

export const DELETE_PRODUCT_REQUEST = "DELETE_PRODUCT_REQUEST";
export const DELETE_PRODUCT_SUCCESS = "DELETE_PRODUCT_SUCCESS";
export const DELETE_PRODUCT_FAIL    = "DELETE_PRODUCT_FAIL";

// ── brands ────────────────────────────────────────────────────────────────────

export const fetchBrands = () => async (dispatch) => {
  try {
    dispatch({ type: FETCH_BRANDS_REQUEST });
    const { data } = await api.get("/brands");
    dispatch({ type: FETCH_BRANDS_SUCCESS, payload: data });
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: FETCH_BRANDS_FAIL, payload: message });
  }
};

export const createBrand = (formData) => async (dispatch) => {
  try {
    dispatch({ type: CREATE_BRAND_REQUEST });
    const { data } = await api.post("/brands", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    dispatch({ type: CREATE_BRAND_SUCCESS, payload: data });
    toast.success("Brand created successfully!");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: CREATE_BRAND_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};

export const updateBrand = (brandId, formData) => async (dispatch) => {
  try {
    dispatch({ type: UPDATE_BRAND_REQUEST });
    const { data } = await api.put(`/brands/${brandId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    dispatch({ type: UPDATE_BRAND_SUCCESS, payload: data });
    toast.success("Brand updated successfully!");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: UPDATE_BRAND_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};

export const deleteBrand = (brandId) => async (dispatch) => {
  try {
    dispatch({ type: DELETE_BRAND_REQUEST });
    await api.delete(`/brands/${brandId}`);
    dispatch({ type: DELETE_BRAND_SUCCESS, payload: brandId });
    toast.success("Brand deleted successfully!");
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: DELETE_BRAND_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};

// ── products ──────────────────────────────────────────────────────────────────

export const addProduct = (brandId, formData) => async (dispatch) => {
  try {
    dispatch({ type: ADD_PRODUCT_REQUEST });
    const { data } = await api.post(`/brands/${brandId}/products`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    dispatch({ type: ADD_PRODUCT_SUCCESS, payload: { brandId, product: data } });
    toast.success("Product added!");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: ADD_PRODUCT_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};

export const updateProduct = (brandId, productId, formData) => async (dispatch) => {
  try {
    dispatch({ type: UPDATE_PRODUCT_REQUEST });
    const { data } = await api.put(`/brands/${brandId}/products/${productId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    dispatch({ type: UPDATE_PRODUCT_SUCCESS, payload: { brandId, product: data } });
    toast.success("Product updated!");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: UPDATE_PRODUCT_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};

export const deleteProduct = (brandId, productId) => async (dispatch) => {
  try {
    dispatch({ type: DELETE_PRODUCT_REQUEST });
    await api.delete(`/brands/${brandId}/products/${productId}`);
    dispatch({ type: DELETE_PRODUCT_SUCCESS, payload: { brandId, productId } });
    toast.success("Product deleted!");
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({ type: DELETE_PRODUCT_FAIL, payload: message });
    toast.error(message);
    throw error;
  }
};
