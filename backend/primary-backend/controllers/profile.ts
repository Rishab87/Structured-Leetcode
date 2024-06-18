//edit additionalProfileInfo like skills , image , education etc
import {z} from 'zod';
import {Request, Response} from 'express';
import prisma from '../config/prismaClient';
import { uploadImageToCloudinary } from '../utils/imageUploader';
import dotenv from 'dotenv';

dotenv.config();

interface RequestWithUserId extends Request{
    userId: string;
    files: any;
}

export const checkForUsername = async(req:Request, res: Response)=>{
    try{
        
        const checkForUsernameSchema = z.object({
            username: z.string()
        });

        const zodValidation = checkForUsernameSchema.safeParse(req.body);

        if(!zodValidation.success){
            return res.status(400).json({error: zodValidation.error , success:false,})
        }

        const {username} = req.body;

        const user = await prisma.user.findFirst({
            where:{
                username
            }
        });

        if(user){
            return res.status(200).json({message: "Username already exists" , success: false})
        }

        return res.status(200).json({message: "Username is available" , success: true})

    } catch(error){
        return res.status(500).json({error: (error as Error).message , success: false})
    }
}

export const updateProfilePicture = async(req:RequestWithUserId  , res:Response)=>{
    try{

        const image = req.files.profileImage;
        const {userId} = req.body;

        //upload to cloudinary

        const cloudImage = await uploadImageToCloudinary(image , process.env.FOLDER_NAME);

        //delete old cloudinary image


        //update in DB
        const user = await prisma.user.update({
            where:{
                id: userId,
            },
            data:{
                image: cloudImage.secure_url,
            }
        });

        return res.status(200).json({success:true , data:user})

    } catch(error){
        return res.status(500).json({error: (error as Error).message , success: false})   
    }
}

export const updateProfileDetails = async(req:RequestWithUserId , res:Response)=>{
    try{

        const {userId} = req.body;

        const user = await prisma.user.findUnique({
            where:{
                id: userId,
            }
        });

        const {firstName= user?.firstName , lastName= user?.lastName , skills= user?.skills , username = user?.username} = req.body;

        const usernameExists = await prisma.user.findFirst({
            where:{
                username
            }
        })
        
        if(usernameExists) return res.status(400).json({success:true , message: "Username already exists"});

        const updatedUser = await prisma.user.update({
            where:{
                id:userId,
            },
            data:{
                firstName,
                lastName,
                skills,
                username,
            }
        });

        return res.status(200).json({success:true , data:updatedUser});

    } catch(error){
        return res.status(500).json({error: (error as Error).message , success: false})
    }
}

export const updateSocials = async(req:RequestWithUserId , res:Response)=>{
    try{

        const {userId} = req.body;

        const user= await prisma.user.findUnique({
            where:{
                id:userId,
            }
        });

        const {instagramUrl = user?.instagramUrl , linkedinUrl = user?.linkedinUrl , youtubeUrl = user?.youtubeUrl , githubUrl = user?.githubUrl} = req.body;

        const updatedUser = await prisma.user.update({
            where:{
                id: userId,
            },
            data:{
                instagramUrl,
                linkedinUrl,
                youtubeUrl,
                githubUrl,
            }
        });

        return res.status(200).json({success:true , data:updatedUser});

    } catch(error){
        return res.status(500).json({error: (error as Error).message , success: false})
    }
}