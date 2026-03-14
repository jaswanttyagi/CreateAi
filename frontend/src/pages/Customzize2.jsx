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
        <div className='min-h-screen w-full bg-gradient-to-t from-[black] to-[#09094d] px-4 py-6 sm:px-6 sm:py-8 lg:px-8'>
            <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
                <div className='flex items-center gap-3'>
                    <button
                        type="button"
                        className='flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20'
                        onClick={() =>
                            navigate("/customize", {
                                state: isEditingAssistant
                                    ? { allowAssistantCustomization: true }
                                    : null,
                            })
                        }
                    >
                        <IoMdArrowRoundBack className='h-6 w-6' />
                    </button>
                    <div>
                        <p className='text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/70'>Step 2</p>
                        <h1 className='text-2xl font-bold text-white sm:text-3xl lg:text-4xl'>
                            Enter your <span className="text-blue-400">assistant&apos;s name</span>
                        </h1>
                    </div>
                </div>

                <div className='rounded-[2rem] border border-white/15 bg-black/30 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur-sm sm:p-8'>
                    <div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
                        <p className='text-sm text-white/75 sm:text-base'>
                            Choose a name that is easy to pronounce so wake-word detection works better on phones, tablets, and desktops.
                        </p>

                        <input
                            type="text"
                            placeholder='eg. Jarvis'
                            required
                            value={assistantname}
                            onChange={(e)=>setAssistantname(e.target.value)}
                            className='w-full rounded-2xl border border-white/25 bg-white/95 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 sm:px-5 sm:py-4 sm:text-base'
                        />

                        {assistantname && (
                            <button
                                disabled={loading}
                                className='min-h-12 w-full rounded-full bg-white px-6 py-3 text-base font-semibold text-black transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg'
                                onClick={()=>{
                                    handleAssistant()
                                }}
                            >
                                {loading ? "Loading..." : isEditingAssistant ? "Update Your Assistant" : "Create Your Assistant"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Customzize2
