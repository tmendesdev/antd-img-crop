import React, { useState, useCallback, useRef } from 'react';
import t from 'prop-types';
import Cropper from 'react-easy-crop';
import LocaleReceiver from 'antd/es/locale-provider/LocaleReceiver';
import Modal from 'antd/es/modal';
import Slider from 'antd/es/slider';
import './index.less';

const pkg = 'antd-img-crop';
const deprecateMap = {
  width: 'aspect',
  height: 'aspect',
  contain: '',
  resize: 'zoom',
  resizeAndDrag: '',
};
const deprecate = (props) => {
  Object.entries(deprecateMap).forEach(([key, val]) => {
    if (props[key] === undefined) return;
    let msg = `\`${key}\` is deprecated`;
    if (val) msg += `, please use \`${val}\` instead`;
    msg += `, see https://github.com/nanxiaobei/${pkg}`;
    console.error(msg);
  });
};

const MEDIA_CLASS = `${pkg}-media`;
const MODAL_TITLE = 'Edit image';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const MIN_ROTATE = 0;
const MAX_ROTATE = 360;
const ROTATE_STEP = 1;

const EasyCrop = (props) => {
  const {
    src,
    aspect,
    shape,
    grid,
    hasZoom,
    zoomVal,
    rotateVal,
    setZoomVal,
    setRotateVal,
    onComplete,
  } = props;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const onCropComplete = useCallback(
    (croppedArea, croppedAreaPixels) => {
      onComplete(croppedAreaPixels);
    },
    [onComplete],
  );

  return (
    <Cropper
      image={src}
      aspect={aspect}
      cropShape={shape}
      showGrid={grid}
      zoomWithScroll={hasZoom}
      crop={crop}
      zoom={zoomVal}
      rotation={rotateVal}
      onCropChange={setCrop}
      onZoomChange={setZoomVal}
      onRotationChange={setRotateVal}
      onCropComplete={onCropComplete}
      classes={{ containerClassName: `${pkg}-container`, mediaClassName: MEDIA_CLASS }}
    />
  );
};

EasyCrop.propTypes = {
  src: t.string,
  aspect: t.number,
  shape: t.string,
  grid: t.bool,
  hasZoom: t.bool,
  zoomVal: t.number,
  rotateVal: t.number,
  setZoomVal: t.func,
  setRotateVal: t.func,
  onComplete: t.func,
};

const ImgCrop = (props) => {
  if (process.env.NODE_ENV !== 'production') deprecate(props);

  const { aspect, shape, grid, zoom, rotate, beforeCrop, modalTitle, modalWidth, children, btnOk, btnCancel } = props;
  const hasZoom = zoom === true;
  const hasRotate = rotate === true;

  const [src, setSrc] = useState('');
  const [zoomVal, setZoomVal] = useState(1);
  const [rotateVal, setRotateVal] = useState(0);

  const dataRef = useRef({});
  const data = dataRef.current;

  /**
   * Upload
   */
  const renderUpload = useCallback(() => {
    const upload = Array.isArray(children) ? children[0] : children;
    if (!data.uploadProps) {
      const { accept, beforeUpload } = upload.props;
      data.beforeUpload = beforeUpload;
      data.uploadProps = {
        accept: accept || 'image/*',
        beforeUpload: (file, fileList) =>
          new Promise((resolve, reject) => {
            if (beforeCrop && !beforeCrop(file, fileList)) {
              reject();
              return;
            }

            data.file = file;
            data.resolve = resolve;
            data.reject = reject;

            const reader = new FileReader();
            reader.addEventListener('load', () => {
              setSrc(reader.result);
            });
            reader.readAsDataURL(file);
          }),
      };
    }
    return { ...upload, props: { ...upload.props, ...data.uploadProps } };
  }, [data, children, beforeCrop]);

  /**
   * EasyCrop
   */
  const onComplete = useCallback(
    (croppedAreaPixels) => {
      data.croppedAreaPixels = croppedAreaPixels;
    },
    [data],
  );

  /**
   * Controls
   */
  const isMinZoom = zoomVal === MIN_ZOOM;
  const isMaxZoom = zoomVal === MAX_ZOOM;
  const isMinRotate = rotateVal === MIN_ROTATE;
  const isMaxRotate = rotateVal === MAX_ROTATE;

  const subZoomVal = useCallback(() => {
    if (!isMinZoom) setZoomVal(zoomVal - ZOOM_STEP);
  }, [isMinZoom, zoomVal]);

  const addZoomVal = useCallback(() => {
    if (!isMaxZoom) setZoomVal(zoomVal + ZOOM_STEP);
  }, [isMaxZoom, zoomVal]);

  const subRotateVal = useCallback(() => {
    if (!isMinRotate) setRotateVal(rotateVal - ROTATE_STEP);
  }, [isMinRotate, rotateVal]);

  const addRotateVal = useCallback(() => {
    if (!isMaxRotate) setRotateVal(rotateVal + ROTATE_STEP);
  }, [isMaxRotate, rotateVal]);

  /**
   * Modal
   */
  const onClose = useCallback(() => {
    setSrc('');
    setZoomVal(1);
    setRotateVal(0);
    dataRef.current = {};
  }, []);

  const onOk = useCallback(async () => {
    onClose();

    const img = document.querySelector(`.${MEDIA_CLASS}`);
    const { naturalWidth, naturalHeight } = img;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // create a max canvas to cover the source image after rotated
    const maxLen = Math.sqrt(Math.pow(naturalWidth, 2) + Math.pow(naturalHeight, 2));
    canvas.width = maxLen;
    canvas.height = maxLen;

    // rotate the image
    if (hasRotate && rotateVal > 0 && rotateVal < 360) {
      const halfMax = maxLen / 2;
      ctx.translate(halfMax, halfMax);
      ctx.rotate((rotateVal * Math.PI) / 180);
      ctx.translate(-halfMax, -halfMax);
    }

    // draw the source image in the center of the max canvas
    const left = (maxLen - naturalWidth) / 2;
    const top = (maxLen - naturalHeight) / 2;
    ctx.drawImage(img, left, top);

    // shrink the max canvas to the crop area size, then align two center points
    const maxImgData = ctx.getImageData(0, 0, maxLen, maxLen);
    const { width, height, x, y } = data.croppedAreaPixels;
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(maxImgData, -left - x, -top - y);

    // get the new image
    const { beforeUpload = () => true, file, resolve, reject } = data;
    canvas.toBlob(async (blob) => {
      blob.lastModifiedDate = Date.now();
      blob.name = file.name;
      blob.uid = file.uid;

      const res = beforeUpload(blob, [blob]);
      if (res === false) return reject();
      if (res === true) return resolve(blob);
      if (typeof res.then === 'function') {
        try {
          const newFile = await res;
          const fileType = Object.prototype.toString.call(newFile);
          resolve(fileType === '[object File]' || fileType === '[object Blob]' ? newFile : blob);
        } catch (err) {
          reject(err);
        }
      }
    });
  }, [data, onClose, hasRotate, rotateVal]);

  return (
    <LocaleReceiver>
      {(locale, localeCode) => (
        <>
          {renderUpload()}
          {src && (
            <Modal
              visible={true}
              wrapClassName={`${pkg}-modal`}
              title={localeCode === 'zh-cn' && modalTitle === MODAL_TITLE ? '编辑图片' : modalTitle}
              width={modalWidth}
              onOk={onOk}
              onCancel={onClose}
              maskClosable={false}
              destroyOnClose
              cancelText={btnCancel}
              okText={btnOk}
            >
              <EasyCrop
                src={src}
                aspect={aspect}
                shape={shape}
                grid={grid}
                hasZoom={hasZoom}
                zoomVal={zoomVal}
                rotateVal={rotateVal}
                setZoomVal={setZoomVal}
                setRotateVal={setRotateVal}
                onComplete={onComplete}
              />
              {hasZoom && (
                <div className={`${pkg}-control zoom`}>
                  <button onClick={subZoomVal} disabled={isMinZoom}>
                    －
                  </button>
                  <Slider
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={ZOOM_STEP}
                    value={zoomVal}
                    onChange={setZoomVal}
                  />
                  <button onClick={addZoomVal} disabled={isMaxZoom}>
                    ＋
                  </button>
                </div>
              )}
              {hasRotate && (
                <div className={`${pkg}-control rotate`}>
                  <button onClick={subRotateVal} disabled={isMinRotate}>
                    ↺
                  </button>
                  <Slider
                    min={MIN_ROTATE}
                    max={MAX_ROTATE}
                    step={ROTATE_STEP}
                    value={rotateVal}
                    onChange={setRotateVal}
                  />
                  <button onClick={addRotateVal} disabled={isMaxRotate}>
                    ↻
                  </button>
                </div>
              )}
            </Modal>
          )}
        </>
      )}
    </LocaleReceiver>
  );
};

ImgCrop.propTypes = {
  aspect: t.number,
  shape: t.oneOf(['rect', 'round']),
  zoom: t.bool,
  grid: t.bool,
  rotate: t.bool,
  beforeCrop: t.func,
  modalTitle: t.string,
  btnOk: t.string,
  btnCancel: t.string,
  modalWidth: t.oneOfType([t.number, t.string]),
  children: t.node,
};

ImgCrop.defaultProps = {
  aspect: 1,
  shape: 'rect',
  grid: false,
  zoom: true,
  rotate: false,
  modalTitle: MODAL_TITLE,
  btnOk: "OK",
  btnCancel: "Cancel",
  modalWidth: 520,
};

export default ImgCrop;
