import {
  CREATE_PROJECT_SUCCESS,
  CREATE_PROJECT_REQUEST,
  CREATE_PROJECT_FAIL,
  FETCH_PROJECTS_REQUEST,
  FETCH_PROJECTS_SUCCESS,
  FETCH_PROJECTS_FAIL,
} from "../actions/projectAction";

const initialState = {
  loading: false,
  projects: [],
  project: null,
  error: null,
};

const projectReducer = (state = initialState, action) => {
  switch (action.type) {
    case CREATE_PROJECT_REQUEST:
    case FETCH_PROJECTS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case CREATE_PROJECT_SUCCESS:
      return {
        ...state,
        loading: false,
        project: action.payload,
        projects: [action.payload, ...state.projects],
        error: null,
      };

    case FETCH_PROJECTS_SUCCESS:
      return {
        ...state,
        loading: false,
        projects: action.payload,
        error: null,
      };

    case CREATE_PROJECT_FAIL:
    case FETCH_PROJECTS_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    default:
      return state;
  }
};

export default projectReducer;
