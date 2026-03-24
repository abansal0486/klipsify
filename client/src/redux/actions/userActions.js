import api from "../../api/axios";

export const GET_USER_REQUEST = "GET_USER_REQUEST";
export const GET_USER_SUCCESS = "GET_USER_SUCCESS";
export const GET_USER_FAIL = "GET_USER_FAIL";

export const UPDATE_USER_REQUEST = "UPDATE_USER_REQUEST";
export const UPDATE_USER_SUCCESS = "UPDATE_USER_SUCCESS";
export const UPDATE_USER_FAIL = "UPDATE_USER_FAIL";


export const getUser = () => async (dispatch) => {
  try {
    dispatch({ type: GET_USER_REQUEST });

    const { data } = await api.get("/users/profile");

    dispatch({
      type: GET_USER_SUCCESS,
      payload: data.data || data,
    });

  } catch (error) {
    dispatch({
      type: GET_USER_FAIL,
      payload: error.response?.data?.message || error.message,
    });
  }
};

export const updateUser = (userData) => async (dispatch) => {

  try {
    dispatch({ type: UPDATE_USER_REQUEST })

    const { data } = await api.put("/users/profile", userData)

    dispatch({
      type: UPDATE_USER_SUCCESS,
      payload: data.data || data,
    });
  } catch (error) {
    dispatch({
      type: UPDATE_USER_FAIL,
      payload: error.response?.data?.message || error.message,
    })
  }
}