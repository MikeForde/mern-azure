#!/bin/bash
set -euo pipefail

DEVICE="/dev/video1"   # Change if needed

# Where we store state for this specific device
STATE_FILE="/tmp/qr_cam_mode_$(basename "$DEVICE")"

# Ensure v4l2-ctl exists
if ! command -v v4l2-ctl &>/dev/null; then
  notify-send "QR Camera" "v4l2-ctl not installed" -i camera-web
  exit 1
fi

apply_qr_mode() {
  echo "Applying QR optimisation to $DEVICE..."

  # ---- QR OPTIMISED PROFILE ----
  v4l2-ctl -d "$DEVICE" -c power_line_frequency=1
  v4l2-ctl -d "$DEVICE" -c focus_automatic_continuous=0
  v4l2-ctl -d "$DEVICE" -c focus_absolute=40
  v4l2-ctl -d "$DEVICE" -c exposure_dynamic_framerate=0
  v4l2-ctl -d "$DEVICE" -c auto_exposure=1
  v4l2-ctl -d "$DEVICE" -c exposure_time_absolute=150
  v4l2-ctl -d "$DEVICE" -c gain=60

  echo "QR" > "$STATE_FILE"
  notify-send "QR Camera" "QR Optimised Mode Enabled" -i camera-photo
}

restore_default_mode() {
  echo "Restoring default camera behaviour on $DEVICE..."

  # ---- RESTORE DEFAULTS ----
  v4l2-ctl -d "$DEVICE" -c focus_automatic_continuous=1
  v4l2-ctl -d "$DEVICE" -c auto_exposure=3
  v4l2-ctl -d "$DEVICE" -c exposure_dynamic_framerate=1
  v4l2-ctl -d "$DEVICE" -c power_line_frequency=2
  v4l2-ctl -d "$DEVICE" -c gain=99

  rm -f "$STATE_FILE"
  notify-send "QR Camera" "Default Camera Mode Restored" -i camera-web
}

# Main toggle: state-file based (deterministic)
if [[ -f "$STATE_FILE" ]]; then
  restore_default_mode
else
  apply_qr_mode
fi

