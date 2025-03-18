import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

//register
export const register = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password, role } = req.body;

    if (!fullname || !email || !phoneNumber || !password || !role) {
      return res.status(400).json({
        message: "Something is missing",
        success: false,
      });
    }

    const file = req.file;
    const fileUri = getDataUri(file);
    const cloudResponse = await cloudinary.uploader.upload(fileUri.content);

    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        message: "User already exist with this email",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      fullname,
      email,
      phoneNumber,
      password: hashedPassword,
      role,
      profile: { profilePhoto: cloudResponse.secure_url },
    });
    return res.status(201).json({
      message: "account created successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

//login

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({
        message: "Something is missing",
        success: false,
      });
    }

    // db m user dhunda
    let user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "incorrect email or password", success: false });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res
        .status(400)
        .json({ message: "incorrect email or password", success: false });
    }

    //check role is correct or not
    if (role !== user.role) {
      return res.status(400).json({
        message: "Account does not exist with current role",
        success: false,
      });
    }

    const tokenData = {
      userId: user._id,
    };

    const token = await jwt.sign(tokenData, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });

    user = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      profile: user.profile,
    };

    // storing token in cookies and returning
    return res
      .status(200)
      .cookie("token", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
      })
      .json({
        message: `Welcome back ${user.fullname}`,
        user,
        success: true,
      });
  } catch (error) {
    console.log(error);
  }
};

export const logout = async (req, res) => {
  try {
    return res.status(200).cookie("token", "", { maxAge: 0 }).json({
      message: "logged out successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

// export const updateProfile = async (req, res) => {
//   try {
//     const { fullname, email, phoneNumber, bio, skills } = req.body;

//     // ******************************

//     //cloudianry ayega idhar

//     const file = req.file; // The file uploaded via Multer (available in `req.file`)

//     let cloudResponse = null;

//     if (!file) {
//       return res.status(400).json({ message: "No file uploaded!" });
//     }

//     // Convert file buffer to Data URI
//     const fileUri = getDataUri(file);

//     if (file) {
//       try {
//         const cloudResponse = await cloudinary.uploader.upload(
//           fileUri.content,
//           {
//             resource_type: "raw",
//           }
//         );
//       } catch (error) {
//         console.error("Cloudinary Upload Error:", error);
//         return res.status(500).json({ message: "File upload failed!" });
//       }
//     }

//     console.log("Uploaded file:", cloudResponse.secure_url);

//     // =================================================
//     // const fileUri = getDataUri(file);
//     // // fileUri cloudinary m jayega
//     // const cloudResponse = await cloudinary.uploader.upload(file.path, {
//     //   resource_type: "raw",
//     // });

//     // console.log("res", res);

//     // *************************
//     let skillsArray;
//     if (skills) {
//       skillsArray = skills.split(",");
//     }

//     const userId = req.id; // middleware authentication
//     let user = await User.findById(userId);

//     if (!user) {
//       return res.status(400).json({
//         message: "User not found",
//         success: false,
//       });
//     }

//     // updating data
//     if (fullname) user.fullname = fullname;
//     if (email) user.email = email;
//     if (phoneNumber) user.phoneNumber = phoneNumber;
//     if (bio) user.profile.bio = bio;
//     if (skills) user.profile.skills = skillsArray;

//     // resume comes later here ..

//     console.log(cloudResponse.secure_url);

//     if (cloudResponse) {
//       user.profile.resume = cloudResponse.secure_url; // save the cloudinary url
//       user.profile.resumeOriginalName = file.originalname; // Save the original file name
//     }

//     await user.save();

//     user = {
//       _id: user._id,
//       fullname: user.fullname,
//       phoneNumber: user.phoneNumber,
//       role: user.role,
//       profile: user.profile,
//       email: user.email,
//     };

//     return res.status(200).json({
//       message: "profile updated successfully",
//       user,
//       success: true,
//     });
//   } catch (error) {}
// };

export const updateProfile = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, bio, skills } = req.body;

    const file = req.file; // The file uploaded via Multer (available in `req.file`)

    if (!file) {
      return res.status(400).json({ message: "No file uploaded!" });
    }

    // Convert file buffer to Data URI
    const fileUri = getDataUri(file);

    const cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
      resource_type: "raw", // Ensure PDFs and other non-images are uploaded correctly
      public_id: `resumes/${file.originalname}`, // Optional: Organize files in Cloudinary
    });

    if (!cloudResponse) {
      return res.status(500).json({ message: "File upload failed!" });
    }

    console.log("Uploaded file:", cloudResponse.secure_url);

    let skillsArray;
    if (skills) {
      skillsArray = skills.split(",");
    }

    const userId = req.id; // middleware authentication
    let user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        message: "User not found",
        success: false,
      });
    }

    // Updating user data
    if (fullname) user.fullname = fullname;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (bio) user.profile.bio = bio;
    if (skills) user.profile.skills = skillsArray;

    if (cloudResponse) {
      user.profile.resume = cloudResponse.secure_url; // Save the Cloudinary URL
      user.profile.resumeOriginalName = file.originalname; // Save the original file name
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user,
      success: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
