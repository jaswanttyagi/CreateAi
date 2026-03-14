import React, { useContext, useState } from 'react'
import { UserDataContext } from '../ContextApi/Usercontext';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IoMdArrowRoundBack } from "react-icons/io";


const Customzize2 = () => {
    const {userData , setUserData , backendImage , selectedImage , serverUrl} = useContext(UserDataContext)
    const [assistantname , setAssistantname] = useState(userData?.assistantName || "" );
    const [loading , setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isEditingAssistant = Boolean(location.state?.allowAssistantCustomization);

    const handleAssistant = async()=>{
        setLoading(true);
        try{
            let formData = new FormData();
            formData.append("assistantName" , assistantname);
            if(backendImage){
                formData.append("assistantImage" , backendImage);
            }
            else{
                formData.append("imageUrl" , selectedImage);
            }
            const result = await axios.post(`${serverUrl}/api/user/updateAssistant` , formData , {withCredentials : true});
            console.log(result.data);
            setUserData(result.data.user);
            navigate("/");
        }catch(err){
            if(err?.response?.status === 401){
                setUserData(null);
                navigate("/login");
                return;
            }
            console.log(err)
        }finally{
            setLoading(false);
        }
    }
    return (
        <div className='w-full h-[100vh] bg-gradient-to-t from-[black] to-[#09094d] flex justify-center items-center flex-col p-[20px] relative'>
            <IoMdArrowRoundBack className='text-white absolute top-[30px] left-[30px] w-[25px] h-[25px] cursor-pointer'
            onClick={() =>
                navigate("/customize", {
                    state: isEditingAssistant
                        ? { allowAssistantCustomization: true }
                        : null,
                })
            }
            ></IoMdArrowRoundBack>
            <h1 className=' font-bold text-white mb-[40px] text-[30px]'>Enter your <span className="text-blue-400">Assistant's name</span></h1>
            <input
                type="text"
                placeholder='eg. Jarvis'
                required   
                value={assistantname}
                onChange={(e)=>setAssistantname(e.target.value)}      
                className='w-full max-w-[600px] rounded-xl border border-white/25 bg-white/95 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 sm:text-base'
            />

            {
            assistantname && <button disabled={loading} className='min-w-[150px] h-[50px] font-semibold text-black bg-white p-[10px] rounded-full text-[20px] mt-[30px] hover:text-blue-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70'
      onClick={()=>{
        handleAssistant()
    }}
      >
        {loading ? "Loading..." : isEditingAssistant ? "Update Your Assistant" : "Create Your Assistant"}
      </button>
            }
        </div>
    )
}

export default Customzize2
