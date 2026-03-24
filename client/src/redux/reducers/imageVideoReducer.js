import {
  GENERATE_CONTENT_REQUEST,
  GENERATE_CONTENT_SUCCESS,
  GENERATE_CONTENT_FAIL,
  CLEAR_GENERATION_ERRORS,
  FETCH_GALLERY_REQUEST,
  FETCH_GALLERY_SUCCESS,
  FETCH_GALLERY_FAIL,
  DELETE_MEDIA_SUCCESS,
   PULL_JOBS_REQUEST,
  PULL_JOBS_SUCCESS,
  PULL_JOBS_FAIL,
} from "../actions/imageVideoAction";

const initialState = {
  gallery: [],
  queue: [],
  loading: false,
  error: null,
  jobId: null,
  referenceImages: [],
  logoImage: null,
  promptText: "",
};

const imageVideoReducer = (state = initialState, action) => {
  switch (action.type) {

    case GENERATE_CONTENT_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case GENERATE_CONTENT_SUCCESS:
      return {
        ...state,
        loading: false,
        jobId: action.payload?.jobId || null,
      };

    case GENERATE_CONTENT_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case CLEAR_GENERATION_ERRORS:
      return {
        ...state,
        error: null,
      };

    case "SET_REFERENCE_IMAGES":
      return {
        ...state,
        referenceImages: [...state.referenceImages, ...action.payload].slice(0, 3),
      };

    case "CLEAR_REFERENCE_IMAGES":
      return { ...state, referenceImages: [] };

    case "REMOVE_REFERENCE_IMAGE":
      return {
        ...state,
        referenceImages: state.referenceImages.filter(
          (_, idx) => idx !== action.payload
        ),
      };

    case "SET_LOGO_IMAGE":
      return {
        ...state,
        logoImage: action.payload,
      };

    case "REMOVE_LOGO_IMAGE":
      return {
        ...state,
        logoImage: null,
      };

    case "SET_PROMPT_TEXT":
      return {
        ...state,
        promptText: action.payload,
      };
       case FETCH_GALLERY_REQUEST:
      return { ...state, loading: true };

    case FETCH_GALLERY_SUCCESS:
      return {
        ...state,
        loading: false,
        gallery: action.payload,
      };

    case FETCH_GALLERY_FAIL:
      return {
        ...state,
        loading: false,
      };

     case DELETE_MEDIA_SUCCESS:
      return {
        ...state,
        gallery: state.gallery.filter((item) => item.id !== action.payload),
        queue: state.queue.filter((item) => item.id !== action.payload),
      };
          case "ADD_GENERATION_QUEUE":
      return {
        ...state,
        queue: [action.payload, ...state.queue]
      };

    case "GENERATION_SUCCESS":
      return {
        ...state,
        queue: state.queue.filter(q => q.id !== action.payload.tempId),
        gallery: [action.payload.data, ...state.gallery]
      };
       case PULL_JOBS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
      case PULL_JOBS_SUCCESS:
      return {
        ...state,
        queue: action.payload, // replace or merge depending on logic
        loading: false,
      };
       case PULL_JOBS_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
      case "JOB_COMPLETED":

  return {
    ...state,
    queue: state.queue.filter(q => q.jobId !== action.payload.jobId),
    gallery: [action.payload, ...state.gallery]
  };

case "JOB_FAILED":

  return {
    ...state,
    queue: state.queue.filter(q => q.id !== action.payload)
  };
  case "SET_JOB_ID":

return {
  ...state,
  queue: state.queue.map(q =>
    q.id === action.payload.tempId
      ? { ...q, jobId: action.payload.jobId }
      : q
  )
};


    default:
      return state;
  }
};

export default imageVideoReducer;
