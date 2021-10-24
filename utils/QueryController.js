
const passport = require("passport");
const Query = require("../models/Query");
const Sender = require("../models/Sender");
require('../middlewares/passport')(passport);
mongoose = require("mongoose");
const Category = require('../models/Category')
const ObjectId = mongoose.Types.ObjectId;
const { SECRET } = require("../config");


// //Show all Queries
const GetAllQueries = async (req, res) => {

    try {
        queries = await Query.aggregate([
            {"$match":{'phone_num':{$nin: [ ' ',null, '8080', 'AutoloadMax', 'TM', '4438' ]} }},
            {
                "$lookup": {
                    "from": 'senders',
                    "localField": 'sender_id',
                    "foreignField": '_id',
                    "as": "sender"
                },
            },
            {
                "$unwind": {
                    "path": "$sender",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'students',
                    "localField": 'sender.student_id',
                    "foreignField": 'student_id',
                    "as": "student"
                }
            },
            {
                "$unwind": {
                    "path": "$student",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },
            {
                "$lookup": {
                    "from": 'faqs',
                    "localField": 'faq_id',
                    "foreignField": '_id',
                    "as": "faq"
                }
            },
            {
                "$unwind": {
                    "path": "$faq",
                    "preserveNullAndEmptyArrays": true
                }
            },

        ]);

        return res.json({
            query_list: queries,
            succes: true
        });


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

//Show Query
const ShowQuery = async (query_id, req, res) => {
    try {
        const query = await Query.aggregate([
            {"$match":{"_id": ObjectId(query_id)}},
            {
                "$lookup": {
                    "from": 'senders',
                    "localField": 'sender_id',
                    "foreignField": '_id',
                    "as": "sender"
                },
            },
            {
                "$unwind": {
                    "path": "$sender",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'students',
                    "localField": 'sender.student_id',
                    "foreignField": 'student_id',
                    "as": "student"
                }
            },
            {
                "$unwind": {
                    "path": "$student",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },
            {
                "$lookup": {
                    "from": 'faqs',
                    "localField": 'faq_id',
                    "foreignField": '_id',
                    "as": "faq"
                }
            },
            {
                "$unwind": {
                    "path": "$faq",
                    "preserveNullAndEmptyArrays": true
                }
            },
        ]);
        if (!query.length) {
            return res.status(404).json({
                message: "Query not Found",
                success: false
            });
        } else {
            return res.json({
                Query: query,
                succes: true
            });
        }

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

// Create new Student
const NewQuery = async ( req, res) => {
    const { sender_id, faq_id, category_id, query_name, possible_answer, status, phone_num } = req;

    try {
        if (!category_id || !query_name || !possible_answer || !status) {
            return res.status(400).json({
                message: `Please enter all fields`,
                success: false
            });
        }
        const newQuery = new Query({
            category_id,
            query_name,
            possible_answer,
            status,
            phone_num
        });
        
        if(sender_id){
            newQuery.sender_id = sender_id;
        }
        
        if(faq_id){
            newQuery.faq_id = ObjectId(faq_id);
        }

        await newQuery.save();
        return res.status(201).json({
            message: "New Query ",
            success: true
        });


    } catch (err) {
        console.log(err)
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
};

// Edit Query
const EditQuery = async (query_id, req, res) => {
    try {
        let query = await Query.findById(query_id);

        if (!query) {
            return res.status(404).json({
                message: "Query not Found",
                success: false
            });
        }
        await Query.findOneAndUpdate({_id: query_id }, req, {
            new: true,
            runValidators: true,
        });

        return res.status(201).json({
            message: "Updated Successfully",
            success: true
        });

    } catch (err) {
        console.log(err)
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

// // Delete Query
const DeleteQuery = async (query_id, req, res) => {
    try {
        let query = await Query.findById(query_id);

        if (!query) {
            return res.status(404).json({
                message: "Student not Found",
                success: false
            });
        }
        await Query.remove({ _id: query_id });

        return res.status(201).json({
            message: "Deleted Successfully",
            success: true
        });

    } catch (err) {
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}


const ShowQueriesByCategory = async (req, id, res) => {

    try {
        // const query = await Query.find({ category_id: ObjectId(id) });
        query = await Query.aggregate([
            {"$match":{
                    'phone_num':{
                            $nin: [ ' ',null, '8080', 'AutoloadMax', 'TM', '4438' ]
                    },
                    'category_id':ObjectId(id),
                }
            },
            {
                "$lookup": {
                    "from": 'senders',
                    "localField": 'sender_id',
                    "foreignField": '_id',
                    "as": "sender"
                },
            },
            {
                "$unwind": {
                    "path": "$sender",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'students',
                    "localField": 'sender.student_id',
                    "foreignField": 'student_id',
                    "as": "student"
                }
            },
            {
                "$unwind": {
                    "path": "$student",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },
            {
                "$lookup": {
                    "from": 'faqs',
                    "localField": 'faq_id',
                    "foreignField": '_id',
                    "as": "faq"
                }
            },
            {
                "$unwind": {
                    "path": "$faq",
                    "preserveNullAndEmptyArrays": true
                }
            },

        ]);

        if (!query) {
            return res.status(404).json({
                message: "Category not Found",
                success: false
            });
        }

        console.log(query);
        return res.status(201).json({
            query_list: query,
            success: true
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

const ShowUnidentifiedQuery = async (req,  res) => {

    try {
        const others = await Category.findOne({ category_name: 'others' });
        query = await Query.aggregate([
            {"$match":{
                    'phone_num':{
                            $nin: [ ' ',null, '8080', 'AutoloadMax', 'TM', '4438' ]
                    },
                    'category_id':others._id,
                },
            },
            { $sort: {_id: -1} },
            {
                "$lookup": {
                    "from": 'senders',
                    "localField": 'sender_id',
                    "foreignField": '_id',
                    "as": "sender"
                },
            },
            {
                "$unwind": {
                    "path": "$sender",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'students',
                    "localField": 'sender.student_id',
                    "foreignField": 'student_id',
                    "as": "student"
                }
            },
            {
                "$unwind": {
                    "path": "$student",
                    "preserveNullAndEmptyArrays": true
                }
            },
            {
                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },
            {
                "$lookup": {
                    "from": 'faqs',
                    "localField": 'faq_id',
                    "foreignField": '_id',
                    "as": "faq"
                }
            },
            {
                "$unwind": {
                    "path": "$faq",
                    "preserveNullAndEmptyArrays": true
                }
            },

        ]);

        return res.status(201).json({
            query_list: query,
            success: true
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

//Show Student

module.exports = {
    NewQuery,
    GetAllQueries,
    ShowQuery,
    EditQuery,
    DeleteQuery,
    ShowQueriesByCategory,
    ShowUnidentifiedQuery
};