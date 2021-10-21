const passport = require("passport");
const FAQ = require("../models/FAQ");
const Category = require("../models/Category");
const Query = require("../models/Query");
mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { NlpManager, SimilarSearch } = require('node-nlp');

require('../middlewares/passport')(passport);
//Show all FAQ
const ShowAllFAQ = async (req, res) => {
    try {

        let faq = await FAQ.aggregate([
            {
                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },

        ]);

        return res.json({
            FAQ_list: faq,
            succes: true
        });
    } catch (error) {
        // Implement logger function (winston)
        return res.status(500).json({
            message: "Unable to show FAQ",
            success: false
        });
    }
}

//Show FAQ
const ShowFAQ = async (req, faq_id, res) => {

    try {
        let faq = await FAQ.aggregate([
            { "$match": { "_id": ObjectId(`${faq_id}`) } },
            {

                "$lookup": {
                    "from": 'categories',
                    "localField": 'category_id',
                    "foreignField": '_id',
                    "as": "category"
                }
            },
            { "$unwind": "$category" },

        ]);

        if (!faq.length) {
            return res.status(404).json({
                message: "FAQ not Found",
                success: false
            });
        } else {
            return res.json({
                FAQ: faq,
                succes: true
            });
        }

        // });


    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

// Create new FAQ
const AddFAQ = async (req, user_id, res) => {
    const { faq_title, faq_answer, faq_utterances, category_id } = req;
    try {
        // Check required fields
        if (!faq_title || !faq_answer || !faq_utterances) {
            return res.status(400).json({
                message: `Please enter all fields`,
                success: false
            });
        }

        // Check Cateegory if it exist
        let checkCategory = await Category.findById(category_id);
        if (!checkCategory) {
            return res.status(404).json({
                message: "The category does not exist",
                success: false
            });
        }
        // create a new FAQ
        const newFAQ = new FAQ({
            faq_title, faq_answer, faq_utterances, category_id
        });

        // await newFAQ.save();
        
        //Scan the Query collection
        ScanQuery(faq_utterances, faq_title, faq_answer, newFAQ._id, category_id)

        return res.status(201).json({
            message: "Added new FAQ ",
            success: true
        });
    } catch (err) {
        console.log(err)
        // Implement logger function (winston)
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
};

// Edit FAQ
const EditFAQ = async (req, faq_id, res) => {
    try {
        console.log(req)
        let faq = await FAQ.findById(faq_id);

        if (!faq) {
            return res.status(404).json({
                message: "FAQ not Found",
                success: false
            });
        }
        await FAQ.findOneAndUpdate({ _id: faq_id }, req, {
            new: true,
            runValidators: true,
        });

        return res.status(201).json({
            message: "Updated Successfully",
            success: true
        });

    } catch (err) {
        return res.status(500).json({
            message: "Server Error",
            success: false
        });
    }
}

// Delete FAQ
const DeleteFAQ = async (req, faq_id, res) => {
    try {
        let faq = await FAQ.findById(faq_id);

        if (!faq) {
            return res.status(404).json({
                message: "FAQ not Found",
                success: false
            });
        }
        faq = await FAQ.remove({ _id: faq_id });

        return res.status(201).json({
            message: "Deleted Successfully",
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

const ShowFAQByCategory = async (req, id, res) => {

    try {
        const faq = await FAQ.find({ category_id: ObjectId(id) });
        console.log(id);
        console.log(faq);
        return res.status(201).json({
            faq_list: faq,
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


const ScanQuery = async (faq_utterances, faq_title, faq_answer, faq_id, category_id) => {
    const manager = new NlpManager({ languages: ['en'], forceNER: true });

    // Get the "Others" Category
    let others = await Category.findOne({ category_name: "Others" });
    if (!others) {
        const createOthers = new Category();
        createOthers.category_name = "Others";
        await createOthers.save();
    }

    // Get query with a category of others or faq_id is null
    let queries = await Query.aggregate([
        {
            "$match": {
                "$or": [
                    { "category_id": ObjectId(others._id) },
                    { "faq_id": null }
                ]
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
    ]);
    // console.log(queries)
    
    // Adds the utterances and intents for the NLP
    faq_utterances.forEach(e => {
        manager.addDocument('en', e, faq_title);
        console.log(e)
        // Train also the NLG
        manager.addAnswer('en', faq_title, faq_answer);
    })

    await manager.train();
    manager.save();


    queries.forEach(async query => {
        const response = await manager.process('en', query.query_name);
        //console.log(response.answer)
        if (response.answer) {
            // console.log(query._id)

            //Update query
            await Query.updateMany(
                { _id: ObjectId(query._id) },
                { $set: { category_id: ObjectId(category_id), faq_id: ObjectId(faq_id) } }
            )
        }
    })


}

module.exports = {
    AddFAQ,
    ShowAllFAQ,
    ShowFAQ,
    EditFAQ,
    DeleteFAQ,
    ShowFAQByCategory
};