import mongoose,{Schema} from "mongoose";


const tweetSchema = new Schema({
    content:{
        type:String,
        required:true,
    },
    owner:{
        type:Schema.Types.Object,
        ref:"User"
    }
}, {timestamps:true});


export const Tweet = mongoose.model("Tweet", tweetSchema);