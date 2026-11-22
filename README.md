# OOTD 캘린더

안드로이드 폰에서 혼자 쓰는 착용샷 캘린더 웹앱(PWA). 확정된 요구사항은 [요구사항.md](요구사항.md)에 있다.

- 앱 주소: https://hhhhh2104-ai.github.io/ootd-calendar/
- 사진·기록 저장: 내 구글 드라이브 › `OOTD 캘린더` 폴더 (`ootd-data.json`, 사진, `썸네일` 폴더)
- 날씨: Open-Meteo (천안)

## PC에서 실행하기

```powershell
npm install
npm run dev
```

- 실제 앱: http://localhost:5173/ootd-calendar/ (구글 로그인 필요)
- 데모 모드: http://localhost:5173/ootd-calendar/?demo (가짜 사진으로 화면만 확인, 저장 안 됨)

## 배포

`main` 브랜치에 올리면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 빌드해서 GitHub Pages에 배포한다.

## 폴더 구조

```
src/
  config.js            설정값 (클라이언트 ID, 지역, 사진 크기, 하단 탭)
  store.js             앱 상태와 저장 동작 (사진 추가·삭제·수정, 날씨)
  router.js            화면 이동 (#/day/날짜 등)
  lib/
    data.js            저장 데이터 구조 (옷장·연결 칸 미리 준비)
    google-auth.js     구글 로그인
    drive.js           구글 드라이브 API
    drive-backend.js   드라이브 폴더·파일 관리
    demo-backend.js    PC 미리보기용 가짜 저장소
    weather.js         날씨 (Open-Meteo)
    image.js           사진 줄이기, 촬영일 읽기
    photo-cache.js     사진 임시 저장
    dates.js           날짜 계산, 한국식 표시
  screens/             캘린더, 상세, 올리기, 설정, 시작 화면
  components/          공통 화면 조각
public/                아이콘, manifest, 서비스 워커, 개인정보처리방침
```
