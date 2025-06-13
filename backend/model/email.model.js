import mongoose from "mongoose";

const emailSchema  = new mongoose.Schema(
    {}
    ,{timestamps:true}
    )

export const Email = mongoose.model('Email', emailSchema)