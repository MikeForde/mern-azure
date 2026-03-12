# 📷 Logitech C920 -- Linux QR Scanning Optimisation

This guide configures a Logitech C920 (or similar UVC webcam) for
**stable, sharp QR code scanning** on Linux (Pop!\_OS / Ubuntu).

------------------------------------------------------------------------

Note, this may not work for a particular Logitech C920 as - for reasons better known to the manafacturers - some are malformed for focus distance:
- larger numbers mean closer e.g. focus_absolute=150 (rather than focus_absolute=40)
- after you switch to QR settings (and having adjusted the focus_absolute to about 150) - using method below - then turn off camera, then switch camera back on, it resets the value to a low number (50 in my example) - while keeping the autofocus switched off - which means it is now focussed in the distance AND auto-focus is off. So, fairly useless for reading QR codes other than the first time you switch the camera on.

------------------------------------------------------------------------

Out-of-the-box settings often cause:

-   Autofocus hunting
-   Exposure drift
-   Motion blur
-   Frame-rate changes under low light

The steps below lock focus and stabilise exposure for reliable animated
QR scanning.

------------------------------------------------------------------------

## 1️⃣ Install Required Tool

Install `v4l-utils` (provides `v4l2-ctl`):

``` bash
sudo apt update
sudo apt install v4l-utils
```

Verify installation:

``` bash
v4l2-ctl --version
```

------------------------------------------------------------------------

## 2️⃣ Identify the Camera Device

List available video devices:

``` bash
v4l2-ctl --list-devices
```

Example output:

    HD Pro Webcam C920 (usb-0000:00:14.0-7):
        /dev/video1
        /dev/video2

👉 Use the primary video node (usually `/dev/video1`).

------------------------------------------------------------------------

## 3️⃣ Verify Camera Controls (Optional)

``` bash
v4l2-ctl -d /dev/video1 --list-ctrls
```

You should see controls like:

-   `focus_automatic_continuous`
-   `focus_absolute`
-   `auto_exposure`
-   `exposure_time_absolute`
-   `gain`
-   `power_line_frequency`

------------------------------------------------------------------------

# 🔧 QR Optimised Camera Configuration

Run the following commands to optimise for QR scanning:

------------------------------------------------------------------------

## ✅ Set Correct Mains Frequency (UK = 50 Hz)

Prevents flicker and exposure hunting:

``` bash
v4l2-ctl -d /dev/video1 -c power_line_frequency=1
```

------------------------------------------------------------------------

## ✅ Disable Continuous Autofocus

Stops focus hunting:

``` bash
v4l2-ctl -d /dev/video1 -c focus_automatic_continuous=0
```

------------------------------------------------------------------------

## ✅ Set Manual Focus (Tune This Value)

Typical useful range for QR scanning: **30--90**

Start here:

``` bash
v4l2-ctl -d /dev/video1 -c focus_absolute=40
```

If slightly blurry:

``` bash
v4l2-ctl -d /dev/video1 -c focus_absolute=60
```

Increase/decrease until QR codes are consistently sharp at your working
distance.

------------------------------------------------------------------------

## ✅ Prevent Exposure From Changing Frame Rate

Stops motion blur during animation:

``` bash
v4l2-ctl -d /dev/video1 -c exposure_dynamic_framerate=0
```

------------------------------------------------------------------------

## ✅ Switch to Manual Exposure Mode

``` bash
v4l2-ctl -d /dev/video1 -c auto_exposure=1
```

------------------------------------------------------------------------

## ✅ Set Exposure Time (Lower = Less Motion Blur)

Good starting value:

``` bash
v4l2-ctl -d /dev/video1 -c exposure_time_absolute=150
```

If image is too dark, increase slightly (e.g. 200--250).

------------------------------------------------------------------------

## ✅ Adjust Gain (Brightness Without Blur)

Start here:

``` bash
v4l2-ctl -d /dev/video1 -c gain=60
```

If image too dark → increase\
If noisy → decrease

------------------------------------------------------------------------

# 📦 Full Recommended QR Profile (Copy/Paste)

``` bash
sudo apt install v4l-utils

v4l2-ctl -d /dev/video1 -c power_line_frequency=1
v4l2-ctl -d /dev/video1 -c focus_automatic_continuous=0
v4l2-ctl -d /dev/video1 -c focus_absolute=40
v4l2-ctl -d /dev/video1 -c exposure_dynamic_framerate=0
v4l2-ctl -d /dev/video1 -c auto_exposure=1
v4l2-ctl -d /dev/video1 -c exposure_time_absolute=150
v4l2-ctl -d /dev/video1 -c gain=60
```

------------------------------------------------------------------------

# 🎯 Result

After applying these settings:

-   Autofocus no longer hunts
-   Frame rate remains stable
-   Motion blur reduced
-   QR detection significantly more reliable
-   Animated dual-QR scanning performs smoothly

------------------------------------------------------------------------

# 📝 Notes

-   Settings reset after unplugging camera or reboot.
-   To toggle on and off, consider using a script - see qr-camera_toggle.sh
-   Add more lighting if image still appears soft --- lighting \>
    exposure tweaks.