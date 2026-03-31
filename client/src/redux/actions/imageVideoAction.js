import api from "../../api/axios";
import { toast } from "react-toastify";
const API_URL = process.env.REACT_APP_API_URL;

/* ================================
   ACTION TYPES
================================ */

export const GENERATE_CONTENT_REQUEST = "GENERATE_CONTENT_REQUEST";
export const GENERATE_CONTENT_SUCCESS = "GENERATE_CONTENT_SUCCESS";
export const GENERATE_CONTENT_FAIL = "GENERATE_CONTENT_FAIL";

export const UPLOAD_REFERENCE_REQUEST = "UPLOAD_REFERENCE_REQUEST";
export const UPLOAD_REFERENCE_SUCCESS = "UPLOAD_REFERENCE_SUCCESS";
export const UPLOAD_REFERENCE_FAIL = "UPLOAD_REFERENCE_FAIL";

export const UPLOAD_LOGO_REQUEST = "UPLOAD_LOGO_REQUEST";
export const UPLOAD_LOGO_SUCCESS = "UPLOAD_LOGO_SUCCESS";
export const UPLOAD_LOGO_FAIL = "UPLOAD_LOGO_FAIL";

export const FETCH_GALLERY_REQUEST = "FETCH_GALLERY_REQUEST";
export const FETCH_GALLERY_SUCCESS = "FETCH_GALLERY_SUCCESS";
export const FETCH_GALLERY_FAIL = "FETCH_GALLERY_FAIL";

export const DELETE_MEDIA_REQUEST = "DELETE_MEDIA_REQUEST";
export const DELETE_MEDIA_SUCCESS = "DELETE_MEDIA_SUCCESS";
export const DELETE_MEDIA_FAIL = "DELETE_MEDIA_FAIL";


// Action types
export const PULL_JOBS_REQUEST = "PULL_JOBS_REQUEST";
export const PULL_JOBS_SUCCESS = "PULL_JOBS_SUCCESS";
export const PULL_JOBS_FAIL = "PULL_JOBS_FAIL";

export const CLEAR_GENERATION_ERRORS = "CLEAR_GENERATION_ERRORS";


/* ================================
   GENERATE IMAGE / VIDEO
================================ */

// export const generateContent = (payload) => async (dispatch) => {
//   try {
//     dispatch({ type: GENERATE_CONTENT_REQUEST });

//     const { data } = await api.post("/video/generate", payload);

//     dispatch({
//       type: GENERATE_CONTENT_SUCCESS,
//       payload: data,
//     });

//     return data;
//   } catch (error) {
//     dispatch({
//       type: GENERATE_CONTENT_FAIL,
//       payload: error.response?.data?.message || error.message,
//     });

//     throw error;
//   }
// };


export const generateContentt = (payload) => async (dispatch) => {

  const tempId = Date.now();

  dispatch({
    type: "ADD_GENERATION_QUEUE",
    payload: {
      id: tempId,
      type: payload.contentType,
      status: "processing"
    }
  });

  const res = await api.post("/video/generate", payload);

  dispatch({
    type: "SET_JOB_ID",
    payload: {
      tempId,
      jobId: res.data.jobId
    }
  });
};

export const generateContent = (payload) => async (dispatch) => {
  try {
    const res = await api.post("/video/generate", payload);

    const jobId = res.data?.jobId;

    if (!jobId) {
      console.error("JobId missing in API response:", res.data);
      toast.error("Generation failed: No job ID returned");
      return;
    }

    // Add queue item with jobId immediately
    dispatch({
      type: "ADD_GENERATION_QUEUE",
      payload: {
        id: Date.now(),
        jobId: jobId,
        type: payload.contentType,
        status: "processing",
      },
    });
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error("Generate content error:", message);
    toast.error(`Generation failed: ${message}`);
  }
};
/* ================================
   FETCH GALLERY
================================ */

// export const fetchGallery = (currentRole, userId) => async (dispatch) => {
//   try {
//     dispatch({ type: FETCH_GALLERY_REQUEST });

//     let res;

//     if (currentRole === "user") {
//       res = await api.get(`/gallery/user/${userId}`);
//     } else {
//       res = await api.get(`/gallery/all`);
//     }

//     dispatch({
//       type: FETCH_GALLERY_SUCCESS,
//       payload: res.data,
//     });

//     return res.data;
//   } catch (error) {
//     dispatch({
//       type: FETCH_GALLERY_FAIL,
//       payload: error.response?.data?.message || error.message,
//     });

//     throw error;
//   }
// };


export const fetchGallery = (currentRole, userId) => async (dispatch) => {
  try {
    dispatch({ type: FETCH_GALLERY_REQUEST });

    let res;

    if (currentRole === "user") {
      res = await api.get(`/gallery/user/${userId}`);
    } else {
      res = await api.get(`/gallery/all`);
    }

    const data = res.data;

    const API_URL = process.env.REACT_APP_API_URL;

    // let gallery = [];

    // if (data?.imageUrls) {
    //   gallery = data.imageUrls
    //     .filter((img) => !img.isDeleted)
    //     .map((img) => ({
    //       id: img._id,
    //       type: "image",
    //       url: img.url.startsWith("http")
    //         ? img.url
    //         : `${API_URL}${img.url}`,
    //       filename: img.filename,
    //       galleryId: data._id,
    //       fileId: img._id,
    //       userId: data.userId,
    //     }));
    // }

    let gallery = [];

/* IMAGES */
if (data?.imageUrls) {
  const images = data.imageUrls
    .filter((img) => !img.isDeleted)
    .map((img) => ({
      id: img._id,
      type: "image",
      url: img.url.startsWith("http")
        ? img.url
        : `${API_URL}${img.url}`,
      filename: img.filename,
      prompt: img.generatedPrompt || "",
      style: img.source,
      galleryId: data._id,
      fileId: img._id,
      userId: data.userId,
      createdAt: img.createdAt
    }));

  gallery = [...gallery, ...images];
}

/* VIDEOS */
if (data?.videoUrls) {
  const videos = data.videoUrls
    .filter((vid) => !vid.isDeleted)
    .map((vid) => ({
      id: vid._id,
      type: "video",
      url: vid.url.startsWith("http")
        ? vid.url
        : `${API_URL}${vid.url}`,
      thumbnail: vid.thumbnail || "",
      filename: vid.filename,
      prompt: vid.generatedPrompt || "",
      style: vid.source,
      galleryId: data._id,
      fileId: vid._id,
      userId: data.userId,
      createdAt: vid.createdAt,
      voiceOverText: vid.voiceOverText || "",
      hasSubtitle: vid.hasSubtitle ?? false,
      videoDuration: vid.videoDuration || "",
    }));

  gallery = [...gallery, ...videos];
}

    dispatch({
      type: FETCH_GALLERY_SUCCESS,
      payload: gallery,
    });

  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({
      type: FETCH_GALLERY_FAIL,
      payload: message,
    });
    toast.error(`Failed to fetch gallery: ${message}`);
  }
};

/* ================================
   DELETE MEDIA
================================ */

export const deleteMedia = (item) => async (dispatch) => {
  try {
    dispatch({ type: DELETE_MEDIA_REQUEST });

    await api.delete(
      `/gallery/${item.type}/${item.galleryId}/${item.fileId}/${item.userId}`
    );

    dispatch({
      type: DELETE_MEDIA_SUCCESS,
      payload: item.id,
    });
    toast.success("Media deleted successfully!");

  } catch (error) {
    const message = error.response?.data?.message || error.message;
    dispatch({
      type: DELETE_MEDIA_FAIL,
      payload: message,
    });
    toast.error(`Delete failed: ${message}`);
  }
};

export const uploadImage = async (file) => {
  if (!file) throw new Error("No file provided");

  // Prepare FormData
  const formData = new FormData();
  formData.append("files", file);

  try {
    const { data } = await api.post("/video/upload-gcs", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!data || !data.success) {
      throw new Error(data?.message || "Upload failed");
    }

    // Use fallback: view or full URL
    const viewUrls = data?.urls?.view || data?.urls?.full || [];
    if (!viewUrls.length) throw new Error("No URL returned from server");

    const relative = viewUrls[0];

    // Return absolute URL
    return relative.startsWith("http") ? relative : `${API_URL}${relative}`;
  } catch (err) {
    console.error("uploadImage error:", err);
    throw new Error(err?.message || "Upload failed");
  }
};

// PullJobs action
// export const pullJobs = (userId) => async (dispatch, getState) => {

//   try {

//     const { generation } = getState();
//     const queue = generation.queue;

//     if (!queue.length) return;

//     const updatedQueue = [];

//     for (const job of queue) {

//       const { data } = await api.get(`/video/job-status/${job.jobId}?userId=${userId}`);

//       if (data.status === "completed") {

//         dispatch({
//           type: "JOB_COMPLETED",
//           payload: data.result
//         });

//       } else if (data.status === "failed") {

//         dispatch({
//           type: "JOB_FAILED",
//           payload: job.id
//         });

//       } else {

//         updatedQueue.push(job);
//       }
//     }

//     dispatch({
//       type: PULL_JOBS_SUCCESS,
//       payload: updatedQueue
//     });

//   } catch (error) {

//     dispatch({
//       type: PULL_JOBS_FAIL,
//       payload: error.message
//     });

//   }
// };

export const pullJobs = (userId) => async (dispatch, getState) => {
  try {

    const { generation, auth } = getState();
    const queue = generation.queue;
    const role = auth?.user?.role;

    if (!queue.length) return;

    let stillProcessing = [];

    for (const job of queue) {

      const { data } = await api.get(`/video/job-status/${job.jobId}?userId=${userId}`);

      // JOB COMPLETED
      if (data.status === "completed") {

        // refresh gallery immediately
        await dispatch(fetchGallery(role, userId));

      }

      // JOB FAILED
      else if (data.status === "failed") {
        console.log("Job failed:", job.jobId);
      }

      // STILL PROCESSING
      else {
        stillProcessing.push(job);
      }
    }

    dispatch({
      type: PULL_JOBS_SUCCESS,
      payload: stillProcessing
    });

  } catch (error) {

    dispatch({
      type: PULL_JOBS_FAIL,
      payload: error.message
    });

  }
};

/* ================================
   CLEAR ERRORS
================================ */

export const clearGenerationErrors = () => (dispatch) => {
  dispatch({ type: CLEAR_GENERATION_ERRORS });
};