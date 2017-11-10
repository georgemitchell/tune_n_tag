#!/bin/bash
VIDEO_ID=$1
ARTIST=$2
ALBUM=$3
SONG=$4
YEAR=$5
TRACK_NUMBER=$6
TOTAL_TRACKS=$7
JOB_ID=$8

CACHE_DIR=../cache
SCRIPT_DIR=`pwd`

SUB_DIR=$ARTIST/$ALBUM

if [ -z "$MUSIC_DIR" ]; then
    MUSIC_DIR=$SCRIPT_DIR/../music
fi 

if [ -z "$MUSIC_USER" ]; then
    MUSIC_USER=george
fi 

LOCAL_DIR="$SUB_DIR"
FINAL_DIR="$MUSIC_DIR/$SUB_DIR"

CURRENT_USER=`whoami`

TEMP_DIR="${CACHE_DIR}/${VIDEO_ID}"
if [ ! -d $TEMP_DIR ]; then
	mkdir $TEMP_DIR
fi

cd $TEMP_DIR
DOWNLOADED_FILE="${VIDEO_ID}.mp3"

update_job () {
	pushd $SCRIPT_DIR
	message=${3:-""}
	echo node update_job.js $1 update $2 "${message}" 
	node update_job.js $1 update $2 "${message}" 
	popd
}

job_fail () {
	pushd $SCRIPT_DIR
	echo node update_job.js $1 fail "${2}" 
	node update_job.js $1 fail "${2}" 
	popd
}

job_success () {
	pushd $SCRIPT_DIR
	echo node update_job.js $1 success "${2}" 
	node update_job.js $1 success "${2}" 
	popd
}

update_job $JOB_ID update 10

if [ ! -f $DOWNLOADED_FILE ]; then
	echo "Downloading file from YouTube"
	youtube-dl --extract-audio --audio-format mp3 -o "%(id)s.%(ext)s" $VIDEO_ID
	rc=$?; if [[ $rc != 0 ]]; then 
		cd $SCRIPT_DIR
		job_fail $JOB_ID "Problem downloading ${SONG} video from YouTube"
		exit $rc
	fi
	update_job $JOB_ID 50 "Successfully downloaded file from YouTube"
else
	update_job $JOB_ID 50 "File already in cache, no need to download"
fi


echo id3tag -1 -a "${ARTIST}" -s "${SONG}" -A "${ALBUM}" -y ${YEAR} -t ${TRACK_NUMBER} -T ${TOTAL_TRACKS} $VIDEO_ID.mp3
id3tag -1 -a "${ARTIST}" -s "${SONG}" -A "${ALBUM}" -y ${YEAR} -t ${TRACK_NUMBER} -T ${TOTAL_TRACKS} $VIDEO_ID.mp3
rc=$?; if [[ $rc != 0 ]]; then 
	cd $SCRIPT_DIR
	job_fail $JOB_ID "Problem tagging ${SONG}"
	exit $rc
fi
update_job $JOB_ID 75 "Successfully tagged mp3 with meta data"

echo "Create ${LOCAL_DIR}"
mkdir -p "${LOCAL_DIR}"

if [ ! -f "${FINAL_DIR}/folder.jpg" ]; then
	echo "Downloading album art"
	echo glyrc cover --artist "${ARTIST}" --album "${SONG}" --write 'folder.:format:'
	glyrc cover --artist "${ARTIST}" --album "${SONG}" --write 'folder.:format:'
	rc=$?; if [[ $rc != 0 ]]; then
		update_job $JOB_ID 90 "Problem downloading cover art for ${SONG}"
	fi
	if [ -f folder.png ]; then
	   echo "PNG file created, convert to jpg"
	   convert folder.png folder.jpg
	   rm folder.png
	fi

	if [ ! -f folder.jpg ]; then
	   echo "Album cover art not found"
	else
		cp folder.jpg "${LOCAL_DIR}/folder.jpg"
		update_job $JOB_ID 90 "Successfully downloaded album art"
	fi
else
	update_job $JOB_ID 90 "Album art already exists, no need to download"
fi

MP3="${LOCAL_DIR}/${SONG}.mp3"


cp $DOWNLOADED_FILE "$MP3"

if [ "$CURRENT_USER" == "$MUSIC_USER" ]; then
	echo "Copy ${ARTIST} to ${MUSIC_DIR}"
	cp -r "${ARTIST}" ${MUSIC_DIR}
else
	echo "Copy ${ARTIST} to ${MUSIC_DIR} and change permission to ${MUSIC_USER}"
	cp -r "${ARTIST}" ${MUSIC_DIR}
	sudo chown -R $MUSIC_USER ${FINAL_DIR}
fi

FINAL_MP3="${FINAL_DIR}/${SONG}.mp3"
JSON={\"mp3_src\":\""${FINAL_MP3}"\"}

job_success $JOB_ID "${JSON}"
echo "Cleanup"
cd ..
rm -rf $TEMP_DIR
