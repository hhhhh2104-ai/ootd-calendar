// 앱 전체 설정값을 모아 둔 파일

// 구글 클라우드 콘솔에서 만든 OAuth 클라이언트 ID (공개용 값)
export const GOOGLE_CLIENT_ID =
  '939904677860-tudr2qpne5vu4kglk3rq8mspdbn6pj65.apps.googleusercontent.com';

// 앱이 만든 파일에만 접근하는 권한
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
// 구글 캘린더 일정 읽기 전용 권한 (만들기·수정·삭제 불가)
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

// 구글 드라이브 저장 위치
export const APP_FOLDER_NAME = 'OOTD 캘린더';
export const PHOTO_FOLDER_NAME = '사진';
export const THUMB_FOLDER_NAME = '썸네일';
export const DATA_FILE_NAME = 'ootd-data.json';

// 날씨 기준 지역
export const LOCATION = {
  name: '천안',
  latitude: 36.8151,
  longitude: 127.1139,
  timezone: 'Asia/Seoul',
};

// 사진 용량 줄이기
export const PHOTO_FULL = { maxSide: 1600, quality: 0.8 };
export const PHOTO_THUMB = { maxSide: 480, quality: 0.75 };

// 하단 탭 메뉴 (탭이 2개 이상일 때만 표시)
export const TABS = [{ key: 'calendar', label: '캘린더', path: '/' }];

export const APP_VERSION = '0.2.2';
