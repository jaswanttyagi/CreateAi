import React, { useContext } from "react";
import { UserDataContext } from "../ContextApi/Usercontext";

const Card = ({ image }) => {
  const {
    setFrontendImage,
    setbackendImage,
    selectedImage,
    setSelectedImage,
  } = useContext(UserDataContext);

  return (
    <div
      className={`aspect-[2/3] w-full max-w-[220px] bg-[#030326] border-2 border-[blue] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-950 hover:border-4 hover:border-[white] ${
        selectedImage === image
          ? "border-4 border-[white] shadow-2xl shadow-blue-950"
          : ""
      }`}
      onClick={() => {
        setSelectedImage(image);
        setbackendImage(null);
        setFrontendImage(null);
      }}
    >
      <img src={image} alt="Assistant option" className="h-full w-full object-cover rounded-2xl" />
    </div>
  );
};

export default Card;
