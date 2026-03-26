import api from "../../api/axios";
import { toast } from "react-toastify";

export const CREATE_PROJECT_REQUEST = "CREATE_PROJECT_REQUEST";
export const CREATE_PROJECT_SUCCESS = "CREATE_PROJECT_SUCCESS";
export const CREATE_PROJECT_FAIL = "CREATE_PROJECT_FAIL";

export const FETCH_PROJECTS_REQUEST = "FETCH_PROJECTS_REQUEST";
export const FETCH_PROJECTS_SUCCESS = "FETCH_PROJECTS_SUCCESS";
export const FETCH_PROJECTS_FAIL = "FETCH_PROJECTS_FAIL";

export const createProject = (payroll) => async (dispatch) => {
  try {
    dispatch({ type: CREATE_PROJECT_REQUEST });

    // payroll can be FormData if files are involved
    const config = {
      headers: {
        "Content-Type": payroll instanceof FormData ? "multipart/form-data" : "application/json",
      },
    };

    const { data } = await api.post("/projects/create-new-project", payroll, config);

    dispatch({ type: CREATE_PROJECT_SUCCESS, payload: data });
    toast.success("Project and Brand created successfully!");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({
      type: CREATE_PROJECT_FAIL,
      payload: message,
    });
    toast.error(message);
    throw error;
  }
};

export const fetchProjects = () => async (dispatch) => {
  try {
    dispatch({ type: FETCH_PROJECTS_REQUEST });
    const { data } = await api.get("/projects/all/user");
    dispatch({ type: FETCH_PROJECTS_SUCCESS, payload: data });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({
      type: FETCH_PROJECTS_FAIL,
      payload: message,
    });
    return [];
  }
};
