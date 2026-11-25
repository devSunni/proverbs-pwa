// ==========================================
// 읽으면서 바로 써먹는 어린이 시리즈 레지스트리
// 새 권(관용구·고사성어·맞춤법 등)을 추가할 때:
//   1) data/<packId>.js 작성 (window.SERIES_DATA[packId] 등록)
//   2) index.html에 <script src="./data/<packId>.js"></script> 추가
//   3) sw.js의 CORE_ASSETS에 './data/<packId>.js' 추가
//   4) 아래 목록에서 ready: true로 변경
// ==========================================
window.SERIES_REGISTRY = [
  {
    id: 'proverbs',
    label: '속담',
    fullTitle: '읽으면서 바로 써먹는 어린이 속담',
    icon: '🍡',
    ready: true,
    accent: '#FF6B4A'
  },
  {
    id: 'idioms',
    label: '관용구',
    fullTitle: '읽으면서 바로 써먹는 어린이 관용구',
    icon: '💬',
    ready: false,
    accent: '#2EC4B6'
  },
  {
    id: 'chengyu',
    label: '고사성어',
    fullTitle: '읽으면서 바로 써먹는 어린이 고사성어',
    icon: '📜',
    ready: false,
    accent: '#8B5CF6'
  },
  {
    id: 'spelling',
    label: '맞춤법',
    fullTitle: '읽으면서 바로 써먹는 어린이 맞춤법',
    icon: '✏️',
    ready: false,
    accent: '#1DA1F2'
  }
];
