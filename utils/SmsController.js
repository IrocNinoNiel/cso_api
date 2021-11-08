const passport = require("passport");
require('../middlewares/passport')(passport);
const SMS = require("../models/SMSMessage");
const mongoose = require("mongoose");
const { nlpFunction,nlpFunctionV2 } = require("../utils/nlp/nlp");
const Query = require("../models/Query");
const axios = require('axios');
const Student = require('../models/Student');
const ObjectId = mongoose.Types.ObjectId;


// Serial port gsm
const serialportgsm = require('serialport-gsm')
const modem = serialportgsm.Modem()

const OpenAndInitializeGSMModule = (io) => {
    // Opening GSM module
    const options = {
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        rtscts: false,
        xon: false,
        xoff: false,
        xany: false,
        autoDeleteOnReceive: false,
        enableConcatenation: true,
        incomingCallIndication: true,
        incomingSMSIndication: true,
        pin: '',
        customInitCommand: '',
        logger: console
    }
    
    modem.open('COM4', options, (data)=>{
        console.log(data);
    });
    modem.on('open', data => {	
        console.log('Modem is open');
        modem.initializeModem((data)=>{
            console.log('Modem is Initialized');
        })
    })
}

const GetAllSms = async(req, res) => {
    try {

        const sms = await SMS.find({'student_phone':{$nin:["AutoLoadMAX","TM",'8080']}}).sort({_id: -1});

        const studentNumList = findStudentNumList(sms);
        const previewMessage = findPreviewMessages(sms);
        
        res.json({
            SMS_list: sms,
            studentNumList: studentNumList,
            previewMessage: previewMessage,
            succes: true
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Unable to Find SMS Messages",
            success: false
        });
    }
}

const GetCurrentMessage = async(req, res,phone_num) => {
    try {
        const sms = await SMS.find();
        const currentMessageList = currentMessageStudentList(sms,phone_num);
        res.json({
            currentMessageList:currentMessageList,
            succes: true
        });
    } catch (error) {
        // Implement logger function (winston)
        return res.status(500).json({
            message: "Unable to Find Current SMS Messages",
            success: false
        });
    }
}

const GetUnreadCurrentMessage = async(req,res) => {
    try {

        const sms = await SMS.find({'type':'recieve','student_phone':{$nin:["AutoLoadMAX","TM",'8080']}}).limit(10).sort({$natural:-1})
        const unread_sms = await SMS.find({'is_read':false,'student_phone':{$nin:["AutoLoadMAX","TM",'8080']}}).limit(10).sort({$natural:-1})
        res.json({
            SMS_list: sms,
            unread_sms_list: unread_sms,
            succes: true
        });
    } catch (error) {
        // Implement logger function (winston)
        return res.status(500).json({
            message: "Unable to Find SMS Messages",
            success: false
        });
    }
}

function findStudentNumList(sms){
    numList = [];
    sms.forEach(element=>{
        const found = this.numList.find(e => e == element.student_phone);
        if(!found) {
            numList.push(element.student_phone)
        }
    })
    return numList;
}

function findPreviewMessages(sms){
    numList = findStudentNumList (sms);
    prevMessageList = []

    // element => element.student_phone === e && element.type === 'recieve'
    numList.forEach(e=>{
        let index = sms.findIndex(
            element => element.student_phone === e
        );

        if(sms[index] == undefined){
            prevMessageList.push('')
        }else{
            prevMessageList.push(sms[index])
        }
    })

    return prevMessageList;
}

function currentMessageStudentList(sms,student_num){
    messageList = [];

    sms.forEach(element=>{
        if(element.student_phone == student_num){
            messageList.push(element);
        }
    })

    return messageList;
}

// Create new Sender
const SendSms = async (req,  res, io) => {
    try {    
        const to = req.number;
        let text = req.text;
        
        if(text.length > 140){

            const tempWord = text;
            const wordArr = [];

            while(text.length != 0){
                wordArr.push(text.substr(0,140))
                if(text.length < 140){
                    text = text.slice(text.length);
                }else{
                    text = text.slice(140);
                }
            }
            
            wordArr.forEach(e=>{
                modem.sendSMS(to, e, false, (data)=>{
                    console.log(data);
                })

                modem.on('onSendingMessage', result => { 
                    console.log(result);
                 })
            })

            modem.getOwnNumber(phone=>{
                const newSMS = new SMS({
                    message:tempWord,
                    officer_phone:phone.data.number,
                    student_phone:to,
                    type:'send',
                    isChatbot:false,
                    student_id:null,
                    chatBotReplyID:null,
                    is_read:true
                });

                newSMS.save((data)=>{
                    // console.log(newSMS);
                    modem.deleteAllSimMessages()
                    io.sockets.emit('newSMSFromOfficer');
                    return res.status(201).json({
                        message: newSMS,
                        success: true
                    });
                });
            })
        }else{
            // Send Messages
            modem.sendSMS(to, text, false, (data)=>{
                // console.log(data);
                if(data.request == 'SendSMS'){
                    try{

                        modem.getOwnNumber((phone)=>{
                            // console.log(phone.data.number);

                            const newSMS = new SMS({
                                message:data.data.message,
                                officer_phone:phone.data.number,
                                student_phone:data.data.recipient,
                                type:'send',
                                isChatbot:false,
                                student_id:null,
                                chatBotReplyID:null,
                                is_read:true
                            });

                            // console.log(newSMS);
                            newSMS.save((data)=>{
                                // console.log(newSMS);
                                modem.deleteAllSimMessages()
                                io.sockets.emit('newSMSFromOfficer');
                                return res.status(201).json({
                                    message: newSMS,
                                    success: true
                                });
                            });

                        });
                        }catch(err){
                        return res.status(500).json({
                            message: "Send SMS Error",
                            success: false
                        });
                        }
                }
            })

            
            modem.on('onSendingMessage', result => { 
                console.log(result);
             })
        }

    } catch (err) {
        console.log(err);
    }
};


const listenReply = (io) => {

    modem.on('onNewMessage', messageDetails =>{  
        // countReply++;  
        // console.log(`Reply count here1113: ${countReply}`)

        modem.emit('messageChannel', {
            message:'Connected to the socket'
        });

        try {
            modem.getOwnNumber((phone)=>{
                
                const newSMS = new SMS({
                    message:messageDetails.message,
                    officer_phone:phone.data.number,
                    student_phone:messageDetails.sender,
                    type:'recieve',
                    isChatbot:false,
                    student_id:null,
                    chatBotReplyID:null,
                    is_read:false
                });
                (async()=>{
                    
                    modem.deleteAllSimMessages();
                    const newData = await SMS.find();
                    const nlpReply = await nlpFunctionV2(messageDetails.message);
                    const findStudentViaNum = await findStudent(messageDetails.sender);
                    console.log(findStudentViaNum)
                    let newContactNumber  = '0'+messageDetails.sender.substring(2);

                    console.log(newContactNumber); 

                    if(!findStudentViaNum.success){
                        try{

                            const response = await axios.get(`http://student-server-dummy.herokuapp.com/${newContactNumber}`);
                            console.log(response.data);
                            const newStudent = new Student({
                                student_id: response.data.Student.student_id,
                                phone_number: messageDetails.sender,
                                school: response.data.Student.school,
                                course: response.data.Student.course
                            });

                            const studentNew = await newStudent.save();
                            if(response.data.success){
                                newSMS.student_id = studentNew._id;
                            }

                        }catch(err){console.log('Student Not Found')}
                    }else{
                        newSMS.student_id = findStudentViaNum.data._id;
                    }
        
                    const newSMSStduent = await newSMS.save();

                    if(nlpReply.success) {
                        // console.log(nlpReply.answer.answer);
                        let text = nlpReply.answer.answer;
                        if(text.length > 140){

                            const tempWord = text;
                            const wordArr = [];
                
                            while(text.length != 0){
                                wordArr.push(text.substr(0,140))
                                if(text.length < 140){
                                    text = text.slice(text.length);
                                }else{
                                    text = text.slice(140);
                                }
                            }
                            
                            wordArr.forEach(e=>{
                                modem.sendSMS(messageDetails.sender, e, false, (data)=>{
                                    console.log(data);
                                })
                
                                modem.on('onSendingMessage', result => { 
                                    console.log(result);
                                 })
                            })

                            modem.getOwnNumber((phone)=>{
                                // console.log(phone.data.number);
    
                                const newSMS = new SMS({
                                    message:tempWord,
                                    officer_phone:phone.data.number,
                                    student_phone:messageDetails.sender,
                                    type:'send',
                                    isChatbot:true,
                                    student_id:null,
                                    chatBotReplyID:newSMSStduent._id,
                                    is_read:true
                                });
    
                                // console.log(newSMS);
                                newSMS.save((data1)=>{
                                    
                                    const newQuery = new Query({
                                        sender_id:ObjectId(newSMSStduent.student_id),
                                        category_id:nlpReply.categoryId,
                                        query_name:messageDetails.message,
                                        possible_answer:tempWord,
                                        faq_id:nlpReply.faqID,
                                        status:"1",
                                        phone_num:messageDetails.sender
                                    });

                                    console.log('Query Save not other')

                                    newQuery.save((data2) => {
                                        modem.deleteAllSimMessages()
                                        // socket.broadcast.emit("newdata", newData);
                                        io.sockets.emit('newdata',newData);  
                                    })
                                });
    
                            });
                
                            
                        }else{
                            modem.sendSMS(messageDetails.sender, nlpReply.answer.answer, false, (data)=>{
                                console.log(data);
                                if(data.request == 'SendSMS'){
                                    try{
                
                                        modem.getOwnNumber((phone)=>{
                                            // console.log(phone.data.number);
                
                                            const newSMS = new SMS({
                                                message:data.data.message,
                                                officer_phone:phone.data.number,
                                                student_phone:data.data.recipient,
                                                type:'send',
                                                isChatbot:true,
                                                student_id:null,
                                                chatBotReplyID:newSMSStduent._id,
                                                is_read:true
                                            });
                
                                            // console.log(newSMS);
                                            newSMS.save((data1)=>{
                                                
                                                const newQuery = new Query({
                                                    sender_id:ObjectId(newSMSStduent.student_id),
                                                    category_id:nlpReply.categoryId,
                                                    query_name:messageDetails.message,
                                                    possible_answer:data.data.message,
                                                    faq_id:nlpReply.faqID,
                                                    status:"1",
                                                    phone_num:data.data.recipient
                                                });
    
                                                console.log('Query Save not other')
    
                                                newQuery.save((data2) => {
                                                    modem.deleteAllSimMessages()
                                                    // socket.broadcast.emit("newdata", newData);
                                                    io.sockets.emit('newdata',newData);  
                                                })
                                            });
                
                                        });
                                    }catch(err){
                                        console.log(err)
                                    }
                                }
                            })
                
                            modem.on('onSendingMessage', result => { 
                                console.log(result);
                             })
                        }
                      
                        
                       
                    } else {
                        
                        modem.sendSMS(messageDetails.sender, nlpReply.message,  false, (data)=>{
                            console.log(data);
                            if(data.request == 'SendSMS'){
                            try{
                                modem.getOwnNumber((phone)=>{
                                    // const newSMS = new SMS({
                                    //     message:data.data.message,
                                    //     officer_phone:phone.data.number,
                                    //     student_phone:data.data.recipient,
                                    //     type:'send',
                                    //     isChatbot:true,
                                    //     student_id:null,
                                    //     chatBotReplyID:newSMSStduent._id,
                                    //     is_read:true
                                    // });
        
                                    // newSMS.save((data1)=>{
                                        
                                    // });

                                    const newQuery = new Query({
                                        sender_id:ObjectId(newSMSStduent.student_id),
                                        category_id:nlpReply.categoryId,
                                        query_name:messageDetails.message,
                                        possible_answer:'N/A',
                                        faq_id:nlpReply.faqID,
                                        status:"1",
                                        phone_num:data.data.recipient
                                    });

                                    console.log('Query Save other')
                                    console.log(newQuery);
                                    newQuery.save((data2) => {
                                        modem.deleteAllSimMessages()
                                        // socket.broadcast.emit("newdata", newData);
                                        io.sockets.emit('newdata',newData);
                                    })
                                    
                                });
                                }catch(err){
                                console.log(err)
                                }
                            }
                            
                        })
                       
                    }

                })();
            });
        } catch(err) {
            console.log(err)
        }
    });
};


const ReadMessage = async(req,res,number) => {
    try{
        await SMS.updateMany({student_phone:number},{$set:{"is_read":true}})
        return res.status(200).json({
            message: "Read All current message",
            success: false
        });
    }catch(err){
        console.log(err)
    }
};

const findStudent = async(phone_num) => {
    try{
        const student = await Student.find({phone_number:phone_num})
        message = {data:'123',success:false};
        if(student.length < 1){
            message.data = null;
            message.success = false
            return message
        }
        message.data = student[0];
        message.success = true;
        return message
    }catch(err){console.log(err)}
}

modem.on('onMemoryFull', result => { console.log(result) })

module.exports = {SendSms, GetAllSms,listenReply,GetCurrentMessage,GetUnreadCurrentMessage,ReadMessage,OpenAndInitializeGSMModule }