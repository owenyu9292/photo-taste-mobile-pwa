# photo-taste-mobile-pwa

휴대폰에서 사진을 보며 취향 태그, 좋음/애매/별로/다시보기, 이유 태그, 메모를 기록하고 `phone_review_patch` ZIP으로 내보내는 모바일 PWA입니다.

이 저장소는 노트북 분석 엔진이 아닙니다.
Ollama, 원본 사진 DB, 기준 분석 기록은 여기에 두지 않습니다.

## 역할

- 휴대폰에서 사진을 고른다.
- 출처를 고른다.
- 좋음, 애매, 별로, 다시보기를 고른다.
- 이유 태그와 직접 태그를 남긴다.
- 메모를 남긴다.
- `photo-taste-phone-patch-*.zip` 파일을 만들고 Google Drive로 전달한다.
- ZIP 안의 `phone_review_patch.json`은 `user_taste`를 중심으로 하며 AI 분석 결과를 담지 않는다.
- 노트북 메인 앱에서 이 ZIP을 가져와 로컬 기준 저장소에 병합한다.

## 데이터 원칙

- GitHub Pages는 앱 배포용이다.
- Google Drive는 전달 박스다.
- 기준 데이터베이스는 노트북 로컬 저장소다.
- 개인 원본 사진, 분석 DB, API key, 토큰은 이 저장소에 올리지 않는다.
- 이 앱은 분석기가 아니라 취향 패치 수집기다. `user_taste`와 `ai_analysis`를 섞지 않는다.

## GitHub Pages

권장 배포:

```text
Repository: owenyu9292/photo-taste-mobile-pwa
Branch: main
Folder: /(root)
```

배포 후 휴대폰에서 Pages URL로 접속하고 홈 화면에 추가해 사용합니다.
