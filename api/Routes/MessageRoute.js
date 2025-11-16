import { getUserDataFromRequest } from "../server.js";
import Message from "../models/Message.model.js";
const MessageRoute = async (req,res) => {
   const {userId} = req.params;
   const userData = await getUserDataFromRequest(req);
   const ourUserId = userData.id;
   const messages = await Message.find({
     sender: { $in: [userId, ourUserId] },
     recipient: { $in: [userId, ourUserId] },
   }).sort({createdAt : 1});
   
   res.json(messages);
}
export default MessageRoute;
