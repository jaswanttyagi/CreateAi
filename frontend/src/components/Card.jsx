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
    <button
      type="button"
      className={`avatar-option aspect-[2/3] w-full max-w-[220px] ${
        selectedImage === image ? "avatar-option-selected" : ""
      }`}
      onClick={() => {
        setSelectedImage(image);
        setbackendImage(null);
        setFrontendImage(null);
      }}
    >
      <img src={image} alt="Assistant option" className="h-full w-full object-cover rounded-2xl" />
      <div className="avatar-option-meta">
        <span className="avatar-option-label">Preset</span>
        <span className="avatar-option-signal">Ready</span>
      </div>
    </button>
  );
};

export default Card;
