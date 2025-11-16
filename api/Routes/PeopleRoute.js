import UserModel from "../models/User.model.js"
export const PeopleRoute = async(req,res)=> {
   const users = await UserModel.find({}, {'_id':1,username:1});
   res.json(users);
}