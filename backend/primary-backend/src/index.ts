import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {connectRedis, connectRedisQueue, redisClient} from '../config/redisClient';
import WebSocket from 'ws';
import prisma from '../config/prismaClient';
import fileUploader from 'express-fileupload';
import authRoutes from '../routes/auth';
import profileRoutes from '../routes/profile'
import problemSubmissionRoutes from '../routes/problemSubmission';
import questionRoutes from '../routes/questions';
import { SubmissionStatus } from '@prisma/client';
import { cloudinaryConnect } from '../config/cloudinary';
import fs from 'fs';
import path from 'path';

const app = express();
dotenv.config();

const allowedOrigins = ['http://localhost:3000' , 'https://codeitup.vercel.app'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);  // Allow the origin
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,  // If you're sending credentials
  })
);
  
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Allowable HTTP methods
  allowedHeaders: ['Origin' , 'Content-Type', 'Authorization'],  // Headers allowed in preflight
  credentials: true,  // Allow credentials (cookies, tokens, etc.)
}));

const wss = new WebSocket.Server({ port: 8080 });

const tempDir = path.join(__dirname , '/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.use(express.json());
app.use(fileUploader({
  useTempFiles: true, 
  tempFileDir: tempDir,
}));
app.use(cookieParser());  
cloudinaryConnect();

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/problem-submission', problemSubmissionRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/profile' , profileRoutes);

const PORT = process.env.PORT || 5000;

let clients = new Map();

wss.on('connection', function connection(ws , req) {

    
    ws.on('message', function incoming(message) {
      const messageString = message.toString(); // Convert the buffer to a string
      const tokenObj = JSON.parse(messageString);
      if(!tokenObj.close){
        clients.set(tokenObj.userId , ws);
      }
      else
        clients.delete(tokenObj.userId);
    });

    //send result of problem to frontend

    ws.on('close', () => {
    });
    
});

//config main jo question hoga uss hisab se input bne honge aur woh input pass h honge function main call ho rha hoga aur woh UI pe nhi dikhaonga code main add krke bhej dunga 

//first problem will submitted using submitProblem controller

//shyd await krna pdega
redisClient.subscribe('submissions' , async(message)=>{
        const {status , userId , questionId ,result , time , memory , difficulty , userCode} = JSON.parse(message);
        //test cases will contain many objects with input and output key
        ////{input: , output:}
        //minTim se zyada lga toh TLE , minTIME bhejo worker ko
        
        //check all test cases in worker and then update status
        //result is output which I will use in case of error or wrong answer and status is the final status of submission

        let subStatus:SubmissionStatus = SubmissionStatus.ACCEPTED;

        if(status === "COMPILE TIME ERROR"){
          subStatus = SubmissionStatus.COMPILE_TIME_ERROR;
        } else if(status == "RUNTIME ERROR"){
          subStatus = SubmissionStatus.RUNTIME_ERROR;
        } else if(status == "WRONG ANSWER"){
          subStatus = SubmissionStatus.WRONG_ANSWER;
        } else if(status == "TIME LIMIT EXCEEDED"){
          subStatus = SubmissionStatus.TIME_LIMIT_EXCEEDED
        }

        const roundedMemory = parseFloat(memory.toFixed(2));
        const roundedTime = parseFloat(memory.toFixed(2));


        
        if(subStatus === SubmissionStatus.ACCEPTED){
          const updateData = {
            [difficulty]: {
              increment: 1, 
            },
            points: {
              increment: 1,
            }
          };
          
          const existingAcceptedSubmissions = await prisma.submissions.findMany({
            where: {
              questionId: questionId,
              userId: userId,
              status: SubmissionStatus.ACCEPTED,
            }
          });

          if (existingAcceptedSubmissions.length === 0) {
            const updatedUser = await prisma.user.update({
              where: {
                id: userId,
              },
              data: updateData,
            });
        }
      }

      await prisma.submissions.create({
        data:{
            status: subStatus,
            executedSpace: roundedMemory,
            executedTime: roundedTime,
            code: userCode,
            Question: {
                connect: {
                    id: questionId
                }
            },
            User: {
                connect: {
                    id: userId
                }
            }
        } , 

    });

        //inc user points if easy question is easy then 1  , medium 2 , hard 3 
        //update easy hard or med question in user profile
        //handle streak cronjob chla skte hai jo har 24 hrs check kre kya user ne submit kiya hai question last 24 hrs agar haan toh kuch mt kro nhi toh streak 0
        //update streak when submitting the question check difference between last submitted and current Time if more than 24 hrs streak++;

        const ws = clients.get(userId);
        if(ws){
          ws.send(JSON.stringify({status , result , time: roundedTime  , memory: roundedMemory}));
        }
    
});

//add editorial and comments feature
const startServer = async()=>{
  await connectRedis();
  await connectRedisQueue();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();