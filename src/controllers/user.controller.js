import {asyncHandler} from "../utils/asyncHandler.js";  
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import { application } from "express";

const generateAccessAndRefreshTokens = async(userId) =>{
  try{
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    //db me bhi rehta hai refresh token 
    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return {accessToken, refreshToken}
     
  } catch(error){
    throw new ApiError(500, "Something went wrong while generating refresh and access token")
  }
}


const registerUser = asyncHandler(async(req, res)=> {
  //steps
  // get details from frontend
  //validation- empty to nhi hai field
  //check if existing already in db
  // get avatar(compulsory) and coverimage
  //upload on cloudinary
  //create user in db (create user object)
  //remove refreshToken and password from response
  //check user created or not
  //return res

  const {fullName, email, username, password } = req.body
  console.log("email: ", email , fullName);
  //console.log("FILES:", req.files);

  // if(fullName === ""){
  //     throw new ApiError(400, "fullname is required")
  // }

  if(
    [fullName, email, username, password].some( (field)=> field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required")
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }]
  })
  if(existedUser){
    throw new ApiError(409, "Email or username already exists")
  }
  //console.log("req.body : ", req.body)
  //console.log("req.files: " ,req.files)

  const avatarLocalPath = req.files?.avatar[0]?.path;

  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  //console.log("Uploaded avatar:", avatar)

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new ApiError(400, "Avatar is required")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    //username: username.toLowerCase()
    username: username?.toLowerCase() || ""

  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
  )

})

const loginUser = asyncHandler(async (req, res)=> {
  //steps
  //req body-> data
  //validate data username, email hai ki nahi
  //find user
  //password check, nhi hua to bol do pass glt
  //access and refresh token
  //send cookies
  //send response 

  const {email, username, password} = req.body
  //console.log("Email:", email, "Username:", username, "Password:",password)
  console.log("Req.body:", req.body)

  // if(!username && !email){
  //   throw new ApiError(400, "Username or Email is required")
  // }

  if(!(username || email)){
    throw new ApiError(400, "username or email is required")
  }

  //can also put one check here is username in smallcase, as it is stored in smallcase in db
  const user = await User.findOne( {
    $or: [{ username }, { email }]
  })
  //const user = await User.findOne({email})
  //console.log("Login query payload:", { username, email })

  if(!user){
    throw new ApiError(404, "user does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)
  //shyd yaha glti hai upr

  if(!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

  //optional, if you think it is costly to call User from db again then leave it, existing user me change change karlo ya to
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  } //ye sirf server se modifiable hai due to httpOnly and secure

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "User logged in successfully"
    )
  )
})

const logoutUser = asyncHandler(async(req, res) => {
  //cookie hatado, refrshToken reset krna hoga
  //isme pehle se user tha hi nahi, logout k time user se email etc thodi loge, aise to vo kisi aur ko bhi logout kr dega  
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged out"))
  
})

const refreshAccessToken = asyncHandler( async(req,res) =>{
  //steps
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401, "unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401, "invalid refresh token ")
    }
  
    //db wale refreshToken se match
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "invalid refresh token either expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const { accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200, 
        {accessToken, newRefreshToken},
        "Access Token Refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
}