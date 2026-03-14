import { useContext } from 'react'
import React, { useRef } from 'react'
import { RiImageAddLine } from 'react-icons/ri'
import Card from '../components/Card'
import image1 from '../assets/images/image1.png'
import image2 from '../assets/images/image2.jpg'
import image4 from '../assets/images/image4.png'
import image5 from '../assets/images/image5.png'
import image6 from '../assets/images/image6.jpeg'
import image7 from '../assets/images/image7.jpeg'
import authBg from '../assets/images/authBg.png'
import { UserDataContext } from "../ContextApi/Usercontext"
import { useLocation, useNavigate } from 'react-router-dom'
import { IoMdArrowRoundBack } from "react-icons/io";


const Customize = () => {

  const { serverUrl, userData, setUserData: persistUser, setFrontendImage, setbackendImage, frontendImage, backendImage, selectedImage, setSelectedImage } = useContext(UserDataContext);
  const inputImage = useRef();

  const navigate = useNavigate();
  const location = useLocation();
  const isEditingAssistant = Boolean(location.state?.allowAssistantCustomization);

  const handleChange = (e) => {
    const file = e.target.files[0];
    setbackendImage(file);
    // now the frontendimage is the url of the backend image and we can use it to show the preview of the image to the user
    setFrontendImage(URL.createObjectURL(file))

  }
  return (
    <div className='w-full h-[full-screen] bg-gradient-to-t from-[black] to-[#09094d] flex justify-center items-center flex-col p-[20px]'>
      <IoMdArrowRoundBack className='text-white absolute top-[30px] left-[30px] w-[25px] h-[25px] cursor-pointer'
        onClick={() => navigate("/")}
      ></IoMdArrowRoundBack>
      <h1 className=' font-bold text-white mb-[40px] text-[30px]'>Choose your <span className="text-blue-400">assistant's avatar</span></h1>
      <div className='w-[90%] max-w-[60%] flex justify-center items-center flex-wrap gap-5'>
        <Card image={image1} />
        <Card image={image2} />
        <Card image={authBg} />
        <Card image={image4} />
        <Card image={image5} />
        <Card image={image6} />
        <Card image={image7} />

        {/* now putting the section where user can use their own image to set the assisant */}
        <div className={`w-[200px] h-[300px] bg-[#030326] border-2 border-[blue] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-950 hover:border-4 hover:border-[white] flex justify-center items-center flex-col gap-3 ${selectedImage === "input" ? 'border-4 border-[white] shadow-2xl shadow-blue-950' : ''}`}
          onClick={() => {
            inputImage.current.click();
            setSelectedImage("input")
          }
          }
        >

          {!frontendImage && <RiImageAddLine className='text-white w-[25px] h-[25px]'></RiImageAddLine>}
          {/*  if frontendImage is presnet then show it */}
          {frontendImage && <img src={frontendImage} alt="preview" className='h-full object-cover rounded-2xl' />}

        </div>
        <input type="file" accept='image/*' ref={inputImage} hidden onChange={handleChange} />
      </div>

      <button className='min-w-[150px] h-[60px] font-semibold text-black bg-white p-[10px] rounded-full text-[20px] mt-[30px] hover:text-blue-200 cursor-pointer'
        onClick={() =>
          navigate("/customize2", {
            state: isEditingAssistant
              ? { allowAssistantCustomization: true }
              : null,
          })
        }
      >
        Next
      </button>


    </div>
  )
}

export default Customize
