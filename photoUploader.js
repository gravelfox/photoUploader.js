import React, {Component} from "react";
import { invokeApig } from "../libs/awsLib";
import { FormGroup, FormControl, ControlLabel, Modal } from "react-bootstrap";
import ReactCrop from "react-image-crop";
import LoaderButton from "./LoaderButton";
import "react-image-crop/dist/ReactCrop.css";
import "./PhotoUploader.css";


// executes "this.props.callback([string])" with the image URL as the string on successful completion...
// reuqires this.props.title to generate filename on MC and column in user table...
// passing a prop of forceSquare={true} will force a square crop, omitting the prop or setting to false
// leaves the ratio in the wild west...

export default class PhotoUploader extends Component {

    constructor(props) {
        super(props);
    
        this.state = {
            uploading: false,
            choosing: true,
            cropping: false,
            confirming: false,
            image: null,
            crop: {
                aspect: this.props.forceSquare ? 1/1 : null,
                width: 50,
                x: 25,
                y: 25
            },
            minCropWidth: null,
            minCropHeight: null,
            pixelCrop: null,
            outputImg: null
        };
    }

    componentDidMount = () => {
        if(!this.props.title) console.log("PhotoUploader requires title to be passed as prop.");
        if(!this.props.callback) console.log("PhotoUploader requres callback to be passed as prop."); 
        if(!this.props.dialogue) console.log("PhotoUploader requires dialogue to be passed as prop.");
        if(!this.props.confirmDialogue) console.log("PhotoUploader requires confirmDialogie to be passed as prop.");
    }

    handleImageSelect = (event) => {

        if(event.target.files && event.target.files.length === 1){
            const reader = new FileReader();
            reader.addEventListener(
                'load',
                () => this.setState({ 
                    image: reader.result,
                    choosing: false,
                    cropping: true
                }), 
                false
            );
            reader.readAsDataURL(event.target.files[0]);
        };
    }

    handleCropChange = (crop) => {
        this.setState({crop});
    }

    handleImageLoad = () => {
        //if image is scaled down, alter the crop object to put the initial square in the new center
        //also set minimum crop percentages
        const image = document.getElementsByClassName("ReactCrop__image")[0];
        var newCrop = Object.assign({}, this.state.crop)
        if( image.clientHeight !== image.naturalHeight || image.clientWidth !== image.naturalWidth ){
            if(image.clientHeight > image.clientWidth) {
                newCrop.width = 50;
                newCrop.height = 50 * (image.clientWidth / image.clientHeight);
                newCrop.y = (100 - newCrop.height) / 2;
            } else if(image.clientHeight < image.clientWidth) {
                newCrop.height = 50;
                newCrop.width =  50 * (image.clientHeight / image.clientWidth);
                newCrop.x = (100 - newCrop.width) / 2;
            } else {
                newCrop.height = 50;
                newCrop.width = 50;
                newCrop.x = 25;
                newCrop.y = 25;
            };
    }

        const minWidth = 200 / image.naturalWidth * 100;
        const minHeight = 200 / image.naturalHeight * 100;
        this.setState({ 
            crop: newCrop,
            minCropWidth: minWidth,
            minCropHeight: minHeight
        });
    } 

    handleCrop = async () => {
        await this.getCroppedImg(document.getElementsByClassName("ReactCrop__image")[0], this.state.crop, `${this.props.title}.jpg`)
        .then((result) => {
            const reader = new FileReader();
            reader.readAsDataURL(result);
            reader.onload = () => {
                this.setState({ 
                    outputImg: reader.result,
                    cropping: false,
                    confirming: true
                 });

            }
        })
    };

    getCroppedImg = (image, pixelCrop, fileName) => {
        const canvas = document.createElement('canvas');
        const maxDimension = 300; //this is the maximum height or width in pixels...
        if(pixelCrop.width / 100 * image.naturalWidth > maxDimension || pixelCrop.height / 100 * image.naturalHeight > maxDimension){
            //if either dimension is greater than 300px...
            var scalePercentage = 1;
            if(pixelCrop.width / 100 * image.naturalWidth >= pixelCrop.height / 100 * image.naturalHeight){
                //if width is greater than or equal to height...
                canvas.width = maxDimension;
                scalePercentage = maxDimension / (pixelCrop.width / 100 * image.naturalWidth);
                canvas.height = (pixelCrop.height / 100 * image.naturalHeight) * scalePercentage;
            } else {
                //if height is greater than width
                canvas.height = maxDimension;
                scalePercentage = maxDimension / (pixelCrop.height / 100 * image.naturalHeight);
                canvas.width = (pixelCrop.width / 100 * image.naturalWidth) * scalePercentage;
            }
        } else {
            //if neither dimension is greater than 300px...
            canvas.width = pixelCrop.width / 100 * image.naturalWidth;
            canvas.height = pixelCrop.height / 100 * image.naturalHeight;
        }
        
        const ctx = canvas.getContext('2d');
      
        ctx.drawImage(
          image,
          pixelCrop.x / 100 * image.naturalWidth,
          pixelCrop.y / 100 * image.naturalHeight,
          pixelCrop.width / 100 * image.naturalWidth,
          pixelCrop.height / 100 * image.naturalHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      
        return new Promise((resolve, reject) => {
          canvas.toBlob(file => {
            file.name = fileName;
            resolve(file);
          }, 'image/png');
        });
    }

    handleCancelCrop = () => {
        this.setState({ 
            cropping: false,
            choosing: true,
            image: null
        });
    }

    handleCropSubmit = async () => {
        this.setState({ uploading: true })
        const payload = {imgData: this.state.outputImg.substr(this.state.outputImg.indexOf(',')+1), imageName: this.props.title};
        try {
            await invokeApig({
                path: `/mc/images`,
                method: "post",
                body: payload
            })
            .then((response) => {
                // console.log(response);
                this.setState({ confirming: false, uploading: false });
                this.props.callback(response.full_size_url);
            })
        } catch (e) {
            this.setState({ uploading: false });
            console.log(e);
            alert("An error occured communicating with MailChimp, check your connection then contact support.")
        }
    }

    render(){
        const image = document.getElementsByClassName("ReactCrop__image")[0];
        return(
            <div>
                {this.state.choosing &&

                    <div>
                        <Modal
                        show={this.state.choosing}
                        onHide={() => {this.props.callback(null)}}>
                            <FormGroup>
                                <Modal.Header>
                                    <ControlLabel>{this.props.dialogue}</ControlLabel>
                                </Modal.Header>
                                <Modal.Body>
                                    <FormControl
                                        name="headshot"
                                        type="file"
                                        onChange={this.handleImageSelect}
                                        accept=".jpg,.jpeg,.png,.bmp"    
                                    />
                                </Modal.Body>
                                <Modal.Footer>
                                <button
                                    onClick={this.props.cancelCallback}
                                    className="btn modal-btn-cancel"
                                    >Go Back</button>
                                    {this.props.skipVerbiage &&
                                <button
                                    onClick={() => {this.props.callback(null)}}
                                    className="btn modal-btn-cancel"
                                    >{this.props.skipVerbiage}</button>
                                    }
                                </Modal.Footer>
                            </FormGroup>
                        </Modal>
                    </div>
                }
                {this.state.cropping &&
                    
                    <Modal
                        show={this.state.cropping}>
                        <Modal.Header>Crop the image...</Modal.Header>
                        <Modal.Body>
                            <div className="crop-container">
                                <ReactCrop
                                    className="crop-object"
                                    src={this.state.image}
                                    crop={this.state.crop}
                                    onChange={this.handleCropChange}
                                    onImageLoaded={this.handleImageLoad}
                                    minWidth={this.state.minCropWidth}
                                    minHeight={this.state.minCropHeight}
                                    style={image ? {"maxWidth": image.clientWidth, "maxHeight": image.clientHeight} : null}
                                />
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button 
                                onClick={this.handleCancelCrop}
                                className="btn modal-btn-cancel"
                            >Cancel</button>
                            <button 
                                onClick={() => {this.handleCrop("this.props.title")}}
                                className="btn modal-btn-submit"
                            >Crop</button>
                        </Modal.Footer>
                    </Modal>
                }
                {this.state.confirming &&
                    <Modal
                        show={this.state.confirming}>
                        <Modal.Header>{this.props.confirmDialogue}</Modal.Header>
                        <Modal.Body>
                            <div className="cropped-img">
                            <img src={this.state.outputImg} alt=""/>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                        <button 
                            className="btn modal-btn-cancel"
                            onClick={() => {this.setState({outputImg: null,confirming: false, cropping: true})}}
                            >Let's try that again</button>
                        <LoaderButton 
                            disabled={this.state.uploading}
                            isLoading={this.state.uploading}
                            text="Perfect"
                            loadingText="Uploading..."
                            className="btn modal-btn-submit"
                            onClick={() => {this.handleCropSubmit(this.props.title)}}
                        />
                        </Modal.Footer>
                    </Modal>
                }
            </div>
        );
    }
}
