import {Router} from "express"
import { loginUser, logoutUser, registerUser, refreshAccessToken} from "../controllers/user.controller.js"
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"


const router = Router()

router.route("/register").post(
  //middleware
  upload.fields([
    {
      name: "avatar",
      maxCount: 1
    },             
    {
      name: "coverImage",
      maxCount: 1
    }
  ]),
  //controller function
  registerUser
  )

router.route("/login").post(loginUser)

//secured routes (user logged in hona chahiye yaha pr)
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)



export default router