#/bin/bash

# make the mp4
ffmpeg -r 15 \
  -i $1 \
  -i $2 \
  -map 0:v \
  -map 1:a \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -codec:a aac \
  -strict experimental \
  -b:a 192k \
  -shortest -y $3

