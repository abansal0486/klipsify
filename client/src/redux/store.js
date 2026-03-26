import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./reducers/authReducer";
import imageVideoReducer from "./reducers/imageVideoReducer";
import userReducer from "./reducers/userReducer";
import paymentReducer from "./reducers/paymentReducer";
import projectReducer from "./reducers/projectReducer";

const store = configureStore({
  reducer: {
    auth: authReducer,
    generation: imageVideoReducer,
    user: userReducer,
    payment: paymentReducer,
    project: projectReducer,
  },
});

export default store;
