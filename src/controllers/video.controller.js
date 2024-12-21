import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary,deleteOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  // const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
  //TODO: get all videos based on query, sort, pagination

  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "_id",
    sortType = "asc",
    userId,
  } = req.query;

  const matchStage = {};
  if (query) {
    matchStage.title = {
      $regex: query,
      $options: "i",
    };
  }

  if (userId && isValidObjectId(userId)) {
    matchStage.userId = mongoose.Types.ObjectId(userId);
  }

  const sortOptions = {
    [sortBy]: sortType === "asc" ? 1 : -1,
  };

  const pipeline = [
    { $match: matchStage },
    { $sort: sortOptions },
    { $skip: (page - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    { $unwind: "$owner" },
    {
      $project: {
        title: 1,
        description: 1,
        videoFile: 1,
        thumbnail: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        createdAt: 1,
        "owner.username": 1,
      },
    },
  ];

  const videos = await Video.aggregate(pipeline);

  const totalVideos = await Video.countDocuments(matchStage);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videos, totalVideos, page, limit },
        "Get All videos Successfully"
      )
    );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description,isPublish } = req.body;
  // TODO: get video, upload to cloudinary, create video
  // const { videoFile, thumbnail } = req.files;

  if (!title && !description) {
    throw new ApiError(400, "All Fields are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is missing.");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);

  if (!videoFile.url) {
    throw new ApiError(400, "videoFile is required");
  }

  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail is missing.");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail.url) {
    throw new ApiError(400, "thumbnail is required");
  }

  const newVideo = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: videoFile.duration,
    isPublish,
    owner: req.user._id,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, newVideo, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  console.log(videoId);
  //TODO: get video by id
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(400, "Video not found");
    }
    res
      .status(200)
      .json(new ApiResponse(200, video, "Video found Successfully"));
  } catch (error) {
    throw new ApiError(500, "Server error");
  }
});

const updateVideo = asyncHandler(async (req, res) => {
    // const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;
  const newThumbnailLocalPath = req.file?.path;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }
  if (!title || !description) {
    throw new ApiError(400, "Provide updated Title and Description");
  }
  if (!newThumbnailLocalPath) {
    throw new ApiError(400, "Provide Thumbnail file");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
console.log(video.owner.toString() === req.user._id.toString())

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not allowed to update this video");
  }

  const deleteThumbnailResponse = await deleteOnCloudinary(video?.thumbnail);
  if (deleteThumbnailResponse?.result !== "ok") {
    throw new ApiError(
      500,
      "Error while deleting old thumbnail from cloudinary"
    );
  }

  const newThumbnail = await uploadOnCloudinary(newThumbnailLocalPath);
  if (!newThumbnail.url) {
    throw new ApiError(500, "Error while uploading new thumbnail");
  }

  const newvideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: newThumbnail.url,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, newvideo, "Video details updated"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not allowed to delete this video");
  }

  const cloudinaryDeleteVideoResponse = await deleteFromCloudinary(
    video.videoFile
  );
  if (cloudinaryDeleteVideoResponse.result !== "ok") {
    throw new ApiError(500, "Error while deleting video from cloudinary");
  }

  const cloudinaryDeleteThumbnailResponse = await deleteFromCloudinary(
    video.thumbnail
  );
  if (cloudinaryDeleteThumbnailResponse.result !== "ok") {
    throw new ApiError(500, "Error while deleting thumbnail from cloudinary");
  }

  const deleteVideo = await Video.findByIdAndDelete(videoId);
  if (!deleteVideo) {
    throw new ApiError(500, "Error while deleting video");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Video Deleted"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not allowed to modify this video status");
  }

  const modifyVideoPublishStatus = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublish: !video.isPublish,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        modifyVideoPublishStatus,
        "Video Publish status modified"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
