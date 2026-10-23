// 川伯 chat script. Every line here is a choice point; see dsl.js for how a conversation is drawn from it.
// Facts come from research/NOTES.md (Portaly policy pages, news coverage); keep them that way.
// Voice: 川伯 is warm, humble and concrete — "說實在", engineering metaphors, real numbers, one idea per bubble.
// The user is a New Taipei grandparent or parent: short, kind, a little Taiwanese, lots of heart.
import { c, me, stk, img, card, elder, alt, opt } from './dsl.js';

// ---------------------------------------------------------------------------------------------------
// Media the script can send. Photos live in public/photos/<id>.jpg (built by tools/photos.py).
export const PHOTOS = {
  ai: { src: '_main/img_06.jpg', alt: '李四川產業四箭：打造 AI 科技之都' },
  medical: { src: '_main/img_07.jpg', alt: '加速新北醫療升級：五大醫療政策' },
  rail: { src: '_main/img_04.jpg', alt: '軌道建設 123：打造 30 分鐘雙北核心生活圈' },
  domecity: { src: '_main/img_03.jpg', alt: '迎接新北巨蛋城：南有巨蛋城、北有科學城' },
  urban: { src: '_main/img_05.jpg', alt: '都更 5 夠力：新北都更更有力' },
  senior: { src: 'healthcare/img_00.jpg', alt: '高齡政策：安心生活三大行動' },
  seniorcard: { src: 'healthcare/img_03.jpg', alt: '敬老卡升級：每月 300 點悠遊卡化' },
  seniorcard600: { src: 'healthcare/img_04.jpg', alt: '敬老卡 600 點：用得廣、用得到、用得完' },
  esports: { src: 'healthcare/img_05.jpg', alt: '新北電競再升級：共創全年齡樂活城市' },
  teeth: { src: 'healthcare/img_07.jpg', alt: '全齡護牙：牙齒好身體好' },
  oldstreet: { src: 'healthcare/img_01.jpg', alt: '老舊公寓巷弄，長輩拄著拐杖散步' },
  elevator: { src: 'healthcare/img_02.jpg', alt: '老公寓外加裝的電梯' },
  housing: { src: 'construction/img_02.jpg', alt: '居住新五箭：承先啟後，打造安居新北' },
  gender: { src: 'education/img_00.jpg', alt: '挺平權：打造性別友善新北' },
  youth: { src: 'education/img_01.jpg', alt: '第一桶金計畫：讓有夢青年跨出創業第一步' },
  edu: { src: 'education/img_02.jpg', alt: '挺教育 3 大亮點' },
  family: { src: 'education/img_03.jpg', alt: '三大親子政策挺家庭' },
  pregnancy: { src: 'education/img_04.jpg', alt: '好孕政策：守護女性健康，新北安心生養' },
  cleaners: { src: 'economy/img_00.jpg', alt: '川伯給清潔隊的 5 個承諾' },
  passport: { src: 'economy/img_01.jpg', alt: '新北職人 Passport' },
  labor: { src: 'economy/img_03.jpg', alt: '做過工的人，才知道工人缺什麼：李四川挺勞工' },
  tourism: { src: 'culture/img_00.jpg', alt: '李四川挺觀光：青春山海線 2.0' },
  hakka: { src: 'culture/img_01.jpg', alt: '李四川挺 Hakka 客家政策' },
  indigenous: { src: 'culture/img_02.jpg', alt: '原力新北・共榮未來' },
  sports: { src: 'culture/img_03.jpg', alt: '運動城市 2.0：世界來比賽，新北天天動' },
  sportseq: { src: 'culture/img_04.jpg', alt: '運動平權 2.0' },
  smokefree: { src: 'culture/img_05.jpg', alt: '打造新北市無菸害商圈' },
  culture: { src: 'culture/img_06.jpg', alt: '李四川挺文化：文化三策' },
  pets: { src: 'Sustainability/img_00.jpg', alt: '李四川提六大動保政策' },
  pets3: { src: 'Sustainability/img_01.jpg', alt: '毛孩 3 政策' },
  bike: { src: '_main/img_08.png', crop: [0, 0, 1280, 1010], alt: '川伯在海邊騎 YouBike' },
  mrt: { src: '_main/img_09.png', crop: [0, 0, 1280, 1010], alt: '川伯在捷運車廂比 OK' },
  bakery: { src: '_main/img_10.png', crop: [0, 0, 1280, 1010], alt: '川伯在觀光工廠' },
  kids: { src: '_main/img_11.png', crop: [0, 0, 1280, 1010], alt: '川伯跟小朋友一起做手作' },
  esportsfun: { src: '_main/img_12.png', crop: [0, 0, 1280, 1010], alt: '川伯跟阿嬤打電競' },
  dog: { src: '_main/img_13.png', crop: [0, 0, 1280, 1010], alt: '川伯抱著狗狗' },
  portrait: { src: '_brand_avatar.jpg', alt: '川伯的大頭照' },
  fist: { src: 'about/img_00.jpg', alt: '川伯握拳打氣' },
  party: { src: '_main/img_01.jpg', alt: '李四川親子派對開放預約' },
};

// Policy cards (LINE rich messages). cat = brand colour of the policy group on Portaly.
export const CARDS = {
  ai: { cat: 'teal', icon: 'chip', title: '產業四箭・AI 科技之都', lines: ['AI 科技廊帶', '產業專區倍增', '無人機產業起飛', 'AI 電競新經濟'], link: 'https://portaly.cc/hammerlee/pages/economy' },
  medical: { cat: 'coral', icon: 'hospital', title: '加速新北醫療升級', lines: ['興建蘆洲醫院', '加速板橋醫療園區', '規劃淡海新市鎮醫院', '強化土城醫療園區', '協助恩主公擴建'], link: 'https://portaly.cc/hammerlee/pages/healthcare' },
  rail: { cat: 'blue', icon: 'train', title: '軌道建設 123', lines: ['一加速：汐東接東環', '兩快線：淡北、大漢溪', '三連通：蘆社大橋等', '30 分鐘雙北生活圈'], link: 'https://portaly.cc/hammerlee/pages/construction' },
  domecity: { cat: 'blue', icon: 'ball', title: '南有巨蛋城 北有科學城', lines: ['樹林鐵路地下化', '延伸民生汐止線', '大漢溪捷運縱貫線', '淡北快線'], link: 'https://portaly.cc/hammerlee/pages/construction' },
  urban: { cat: 'red', icon: 'house', title: '都更 5 夠力', lines: ['府級整合', '容積檢討', '防災優先', '防洪韌性', '以地易地'], link: 'https://portaly.cc/hammerlee' },
  seniorcard: { cat: 'purple', icon: 'coin', title: '敬老卡升級 2.0', lines: ['600 點完全保留', '300 點悠遊卡化', '看病拿藥都能用', '超商藥局計程車'], link: 'https://portaly.cc/hammerlee/pages/healthcare' },
  homecheck: { cat: 'purple', icon: 'house', title: '高齡安心六大檢查', lines: ['用電・防火・防災', '防跌・無障礙・急難', '每戶最高補助 3 萬', '獨居長輩主動上門'], link: 'https://portaly.cc/hammerlee/pages/healthcare' },
  family: { cat: 'pink', icon: 'bottle', title: '三大親子政策', lines: ['好孕專車延長到 1 歲', '運動中心免費臨托', 'BABY BOSS 成長館'], link: 'https://portaly.cc/hammerlee/pages/education' },
  tourism: { cat: 'orange', icon: 'mountain', title: '青春山海線 2.0', lines: ['搭纜車上山城', '騎單車到海邊', '搭遊船賞美景', '周遊券玩山海'], link: 'https://portaly.cc/hammerlee/pages/culture' },
  pets: { cat: 'coral', icon: 'dog', title: '六大動保政策', lines: ['市立動保醫院', '生命紀念園區', '野生動物救傷中心', '動物之家升級'], link: 'https://portaly.cc/hammerlee/pages/Sustainability' },
};

// 長輩圖: big text over a cheerful painted background (drawn by src/share/elder.js)
export const ELDER = {
  morning: { lines: ['早安', '平安喜樂'], sub: '新北 29 區 天天好天氣', theme: 'sunrise' },
  happy: { lines: ['天天開心', '身體健康'], sub: '川伯祝你 呷百二', theme: 'lotus' },
  peace: { lines: ['平安', '就是福'], sub: '出門平安 回家團圓', theme: 'sky' },
  work: { lines: ['認真打拚', '新北更讚'], sub: '做事的人 做成事的人', theme: 'gold' },
  tea: { lines: ['午安', '喝杯茶吧'], sub: '休息一下 再出發', theme: 'tea' },
};

// ---------------------------------------------------------------------------------------------------
// Opening. The greeting follows the user's clock (bucket 0 morning, 1 noon, 2 afternoon, 3 evening).
export const GREETINGS = [
  [
    c('早安！我是李四川，大家都叫我川伯[sun]', '早安喔～吃早餐了沒？我是川伯[smile]', '早啊！今天天氣不錯，我是李四川，叫我川伯就好[sun]'),
  ],
  [
    c('午安！吃飽沒？我是李四川，叫我川伯就好[smile]', '午安～中午吃什麼？我是川伯[smile]', '午安！我是川伯李四川，你好你好[sparkle]'),
  ],
  [
    c('午安～我是川伯李四川，喝杯茶休息一下吧[tea]', '下午好！我是李四川，大家都叫我川伯[smile]', '你好你好！我是川伯，下午有空聊聊天嗎[tea]'),
  ],
  [
    c('晚安！忙了一天辛苦了，我是川伯[smile]', '晚上好～吃飽了嗎？我是李四川，叫我川伯就好[smile]', '晚安喔！我是川伯，今天過得好嗎[star]'),
  ],
];

export const OPENING = [
  opt(stk('chuan', 'c_hello')),
  me('川伯好！', '哇，是川伯本人耶！', '川伯你好～我有在電視上看過你喔', '川伯好！我是新北人', '你好你好～早就想跟你聊聊了'),
  c('說實在，我是做工程的人，做了四十年，路、橋、捷運都蓋過[hammer]', '我是做工程出身的，從基層公務員做起，做了四十年[hammer]', '我這輩子都在蓋東西：路、橋、捷運、醫院[hammer]'),
  c('今天想跟你聊聊我做過的事，還有新北接下來要怎麼走。你往下滑，我們慢慢聊[thumb]', '我跟你聊聊我做過的事，還有新北的下一段路。你慢慢往下滑就好[thumb]', '你不用打字，往下滑就好，我們像老朋友一樣慢慢聊[smile]'),
  me('好啊！我有空', '好喔，我泡杯茶來聽[tea]', '你說你說，我在聽！', '來來來，我最愛聽故事了'),
];

// ---------------------------------------------------------------------------------------------------
// Past (about a quarter of the chat). NVIDIA always comes first: it is the one everyone remembers.
export const NVIDIA = {
  id: 'nvidia', title: '輝達落腳台北',
  seq: [
    alt(
      [me('川伯，聽說輝達的總部要蓋在台北，跟你有關係喔？'),
        c('對！輝達的海外總部，要蓋在北投士林科技園區的 T17、T18。我那時候是台北市副市長，負責去談[chip]',
          '是真的！輝達的海外總部落腳北士科 T17、T18。那時候我是台北市副市長，帶著市府的小組去談[chip]')],
      [me('我孫子一直說輝達、輝達，那跟你有關係嗎？'),
        c('有喔！輝達的海外總部落腳北士科 T17、T18。那時候我是台北市副市長，帶著市府的小組去談，最後代表市府簽約[chip]')],
      [c('先跟你說一件我心裡很高興的事[sparkle]'),
        c('輝達的海外總部，要蓋在北投士林科技園區的 T17、T18。那時候我是台北市副市長，負責去談[chip]')],
    ),
    c('那塊地原本有新光人壽的地上權，談了很久都卡住。我提出「第三方鑑價」，大家講道理，才終於解開。',
      '說實在，最難的是那塊地：新壽的地上權要先收回來。我提了「第三方鑑價」，讓數字說話，事情就動了。'),
    c('2026 年 2 月 11 日，我代表台北市政府跟輝達簽約。簽完那一刻，比蓋好一座橋還感動[heart]',
      '2 月 11 日簽約那天，我心裡想：台灣的 AI，這一步踩穩了[heart]'),
    alt([stk('chuan', 'c_fist', 'c_think')], []),
    me('哇～好期待 AI 大公司也來新北！[sparkle]', '原來川伯出了這麼大的力，太厲害了', '我孫子說以後要去輝達上班哈哈[laugh]', '台灣之光！川伯也是新北之光[star]', '難怪大家都說你是做事的人！'),
    c('我常講：合情合理、大家都講得通的事，就要在法令裡找到路，把它做成。新北的 AI 產業，我也會這樣一件一件談下來。',
      '這只是開始。AI 要的人才、廠房、交通，新北都接得住。等一下再跟你說[smile]'),
  ],
};

// how the chat turns from NVIDIA to one more story from his past
export const PAST_LEAD = [
  alt(
    [c('講到這個，我想起以前的事[smile]', '說到做事，再跟你分享一件我很有感的事。')],
    [me('川伯以前都在做什麼呀？', '川伯年輕的時候是怎麼過來的？')],
  ),
];

export const PAST = [
  { id: 'mrt', title: '三環三線',
    seq: [
      c('你知道捷運「三環三線」嗎？是朱立倫市長那時候規劃的，我那時是新北副市長，一路都在現場[train]',
        '講到捷運我就有話說了。朱立倫市長規劃「三環三線」的時候，我是新北副市長[train]'),
      c('那時候很多人笑我們「三環三線，夢裡相見」。現在環狀線在跑、機場線在跑、淡海輕軌也在跑。'),
      me('對啊！我現在搭環狀線去看孫子，很方便', '以前去板橋要轉好幾趟車，現在好多了', '夢裡相見變成真的了哈哈[laugh]'),
      c('說實在，笑話會過期，捷運不會[smile]', '路是一段一段接起來的，急不得，但也不能停[hammer]'),
    ] },
  { id: 'dome', title: '大巨蛋',
    seq: [
      c('台北大巨蛋卡了很多年，大家都記得吧？我在台北市副市長任內，幫忙把卡關的地方一個一個解開，後來終於完工啟用[ball]'),
      c('其實我在台北市工務局的時候，也參與過小巨蛋的工程。從小巨蛋到大巨蛋，跟巨蛋很有緣[laugh]',
        '我在台北市工務局的時候，也參與過小巨蛋的工程喔。一輩子都在跟工地打交道[helmet]'),
      me('我有去大巨蛋看球！真的很讚[ball]', '原來大巨蛋也有川伯的功勞喔', '那新北也要有巨蛋了吧？'),
    ] },
  { id: 'tucheng', title: '土城醫院',
    seq: [
      c('土城醫院，我從會勘、協調，到看著它一層一層蓋起來，整整跟了五年[hospital]'),
      c('所以我知道，一間醫院要從圖上走到地上有多難，也知道怎麼讓它走得快一點。'),
      me('土城醫院我爸媽都在那裡看病，很方便', '五年！川伯真有耐心', '蓋醫院是功德一件啊[pray]'),
    ] },
  { id: 'roots', title: '小琉球的孩子',
    seq: [
      c('跟你講個小故事。我是小琉球討海人的兒子[wave]', '你知道嗎？我是在小琉球長大的，爸爸是討海人[wave]'),
      c('我出生的時候，爸爸拍電報幫我取名叫「書川」，結果登記成「四川」，就這樣叫了一輩子[laugh]'),
      opt(c('後來讀岡山農工，老師留我們下來課後輔導。對一個窮孩子來說，那是一條翻身的路[book]')),
      me('原來是書川變四川！太可愛了[laugh]', '小琉球！我去玩過，海很漂亮[wave]', '川伯也是苦過來的，難怪這麼懂我們'),
    ] },
  { id: 'licenses', title: '半工半讀',
    seq: [
      c('我讀台北工專的時候半工半讀，做水電、裝冷氣[muscle]'),
      alt(
        [c('電匠、室內配線、工業配線甲級、空調甲級，四張執照都是自己一張一張考的。'),
          me('四張執照！難怪大家叫你 Hammer[hammer]', '做過工的人，最知道工人辛苦')],
        [c('我還開過麵包店喔！洗攪拌桶洗到現在都記得：留一點油，蛋白就打不發[cake]'),
          me('還開過麵包店？川伯會做鳳梨酥嗎[pineapple]', '原來川伯什麼都做過！')],
      ),
    ] },
  { id: 'gongguan', title: '公館圓環',
    seq: [
      c('在台北的時候，我們市府團隊改善公館圓環，事故率降了五成多[check]'),
      c('路是手段，人才是目的。家人出門，能平平安安回家，才是最重要的。'),
      me('公館圓環以前真的很可怕！', '平安最重要[pray]', '原來改路口，事故可以少這麼多'),
    ] },
];

// Bridge from the past to the future.
export const BRIDGE = [
  me('川伯，那你當新北市長，要為我們做什麼？', '聽起來好厲害，那新北呢？你要怎麼做？', '那新北接下來呢？我們新北人也想要！'),
  c('說實在，我把它整理成「五大建設」，要蓋出新北下一個 30 年。我一件一件講給你聽[hammer]',
    '好問題！新北的下一段路，我知道怎麼鋪。我們從最重要的講起[thumb]',
    '來，我把新北的下一步，一件一件講給你聽。四川開路，新北進步[hammer]'),
  opt(stk('chuan', 'c_hammer', 'c_shovel', 'c_salute')),
];

// ---------------------------------------------------------------------------------------------------
// The five big builds (always all five, in a shuffled order).
export const FUTURE_A = [
  { id: 'ai', title: 'AI 科技之都', cat: 'teal',
    seq: [
      alt(
        [me('川伯，我很關心 AI 欸，聽說以後工作都要靠它'), c('真的很謝謝你這麼重視 AI，我會把新北打造成「AI 科技之都」[chip]')],
        [me('川伯，AI 到底是什麼？我孫子整天在講'), c('哈哈，AI 就是讓電腦變聰明。我要把新北做成「AI 科技之都」，讓年輕人的工作留在家鄉[chip]')],
        [c('來講講我很有把握的事：把新北打造成「AI 科技之都」[chip]')],
      ),
      alt(
        [c('在寶高智慧園區，有家公司的副總跟我說：他們的工程師凌晨兩點想到點子，就直接開車進辦公室。'),
          c('AI 的競爭是全世界的，但工程師的生活，是在一個城市裡過的。人才要留得住，城市要接得住。'),
          me('年輕人凌晨兩點還在拚，川伯要照顧他們喔', '這樣我孫子畢業就不用跑去外地上班了')],
        [c('我提「產業四箭」：AI 科技廊帶、產業專區倍增、無人機產業起飛、AI 電競新經濟[sparkle]'),
          alt([img('ai')], [card('ai')], []),
          me('無人機！聽起來好好玩[drone]', 'AI 之都，聽起來就很有未來感[sparkle]', '哇～好期待新北也變成 AI 重鎮！')],
        [c('蘆社大橋要蓋起來，接北士科、串台 64、台 65，讓研發、製造、出口在新北一條龍[bridge]'),
          alt([img('ai')], [stk('chuan', 'c_fist', 'c_cheer')]),
          me('一條龍！這樣工作就留在新北了', '哇～好期待新北也變成 AI 重鎮！')],
      ),
      alt(
        [c('新北的凌晨兩點，有人開車進辦公室；新北的下一個 30 年，有人已經開始蓋[hammer]')],
        [c('橋要一墩一墩蓋，產業鏈要一節一節接。這個我最在行[hammer]')],
        [stk('me', 'm_wow', 'm_love')],
      ),
    ] },
  { id: 'medical', title: '加速新北醫療升級', cat: 'coral',
    seq: [
      alt(
        [c('來講醫療。這件事跟每個家庭都有關係[hospital]')],
        [me('川伯，我們長輩最在意的，就是看病方不方便'), c('我懂！所以我要「加速新北醫療升級」[hospital]')],
        [c('說到看病，新北人最有感。我要加速新北醫療升級[hospital]')],
      ),
      alt(
        [c('五大醫療政策：興建蘆洲醫院、加速板橋醫療園區、規劃淡海新市鎮醫院、強化土城醫療園區、協助恩主公醫院擴建。')],
        [c('近 20 萬人的蘆洲，該有一間自己的大醫院；55 萬人的板橋，量能要補上。'), c('淡海的長輩，復健照護要就近解決；土城、恩主公也要再擴大。')],
        [c('做法很實在：用 BOT 加速興建，哪一區不夠，就補哪一區。蘆洲、板橋、淡海、土城、三峽恩主公，五個地方一起來。')],
      ),
      alt([img('medical')], [card('medical')], [stk('chuan', 'c_ok')]),
      me('蘆洲終於要有大醫院了！我住三重，太好了', '半夜掛急診不用跑那麼遠，安心多了', '看病方便，長輩最需要[pray]', '淡海也有醫院，住北海岸的親戚一定很高興'),
      c('醫院不是蓋給地圖看的，是蓋給每一個半夜掛急診的家庭。',
        '路，我鋪到了 29 區。醫療，我要蓋進每一個生活圈[heart]'),
    ] },
  { id: 'rail', title: '軌道建設 123', cat: 'blue',
    seq: [
      alt(
        [c('講到我的老本行了：捷運[train]')],
        [me('川伯，捷運什麼時候才會到我家附近？'), c('這個問得好，是我的老本行[train]')],
        [c('再來是大家最常問我的：捷運[train]')],
      ),
      c('我叫它「軌道建設 123」：一加速、兩快線、三連通，加起來是「30 分鐘雙北生活圈」[clock]'),
      alt(
        [c('一加速，汐東線接東環段；兩快線，淡北快線跟大漢溪捷運縱貫線；三連通，蘆社大橋、中和光復線、深坑輕軌延伸石碇。'),
          me('淡北快線我等好久了！', '三連通，聽起來好像接水管，川伯真的是工程師哈哈[laugh]')],
        [c('簡單講，就是把雙北捷運斷掉的地方接起來，讓你在站內就轉得了車，不用出站再等公車。'),
          me('站內就能轉車，對我們老人家最方便', '30 分鐘！那我去台北看女兒就更快了[clock]')],
        [alt([img('rail')], [card('rail')]),
          me('淡北快線我等好久了！', '30 分鐘！那我去台北看女兒就更快了[clock]', '捷運到家門口，真的是夢想[train]')],
        [img('mrt'),
          me('川伯比 OK 好可愛[laugh]', '30 分鐘！那我去台北看女兒就更快了[clock]')],
      ),
      c('省下來的 30 分鐘，不是給捷運的，是給家人的[heart]', '笑話會過期，捷運不會。我會把它們連成一張網。'),
    ] },
  { id: 'domecity', title: '南有巨蛋城 北有科學城', cat: 'blue',
    seq: [
      alt(
        [c('新北也要有自己的巨蛋了[ball]')],
        [me('聽說新北巨蛋要蓋在樹林？'), c('對！新北巨蛋落腳樹林，我要讓它變成一座「巨蛋城」[ball]')],
      ),
      alt(
        [c('我提出「南有巨蛋城、北有科學城」：南邊帶動樹林、土城、新莊、三峽、鶯歌；北邊用淡海科學城串起北士科，做科技走廊。'),
          alt([img('domecity')], [card('domecity')], []),
          me('樹林要變新都心了，住鶯歌的老朋友一定很開心', '南北兩頭都有發展，好')],
        [c('交通要先到位：樹林鐵路分階段地下化、延伸到鶯歌，樹林車站立體化，變成巨蛋城的新門戶。'),
          alt([img('domecity')], [stk('chuan', 'c_shovel')], []),
          me('鐵路地下化，以後就不用等平交道了[check]', '樹林車站要變漂亮了')],
        [c('我還要去爭取世界棒球經典賽、大聯盟海外賽來新北比賽[ball]'),
          alt([stk('chuan', 'c_shovel')], []),
          me('大聯盟來新北！我一定要去看[ball]', '我要帶孫子去看棒球！')],
      ),
      c('南有巨蛋城、北有科學城，是城市格局的重新安排，為了布局未來三十年。',
        '說實在，巨蛋不是給人看的，是給人進去的[smile]'),
    ] },
  { id: 'urban', title: '都更 5 夠力', cat: 'red',
    seq: [
      alt(
        [c('我們新北有很多老房子，這件事我一直放在心上[house]')],
        [me('我住的公寓四十幾年了，都更還有希望嗎？'), c('有！這件事我一直放在心上[house]')],
      ),
      alt(
        [c('新北 30 年以上的老屋大概有 100 萬戶。有報導算過，照以前的速度，要 1000 年才更新得完。'),
          me('1000 年太久了啦，川伯拜託快一點[laugh]', '這樣不行，要加快！'),
          c('所以我提「都更 5 夠力」，政府要從「審都更」，變成「幫都更」[hammer]')],
        [c('我提「都更 5 夠力」：市長親自召集、容積全面重審、危老專責窗口、滯洪設施入都更、小基地不再卡住[hammer]'),
          alt([img('urban')], [card('urban')], []),
          me('老公寓終於有希望了', '滯洪也顧到，下大雨就不怕淹了')],
      ),
      alt(
        [c('房子要安全，家人才安心。這一關我會一直推[hammer]')],
        [stk('chuan', 'c_run', 'c_salute')],
      ),
    ] },
];

// Everyday-life policies: 3 or 4 of these follow the five builds.
export const FUTURE_B = [
  { id: 'seniorcard', title: '敬老卡升級 2.0', cat: 'purple',
    seq: [
      c('跑遍新北 29 區，長輩最常跟我說：「點數很多，但能用的地方可以更多。」'),
      c('敬老卡升級 2.0：600 點完全保留，其中 300 點悠遊卡化，看病、拿藥、到便利商店買東西都能用[coin]'),
      alt([img('seniorcard', 'seniorcard600')], [card('seniorcard')]),
      me('可以去藥局用？那太好了！', '便利商店也能用，我每天都會用到[check]', '長輩最需要的就是這個'),
      c('鋪了一輩子的路，這次要鋪到長輩心裡[heart]', '長輩要的不是更多點數，是要用的時候，真的用得到。'),
    ] },
  { id: 'homecheck', title: '高齡安心六大檢查', cat: 'purple',
    seq: [
      c('新北超過 80 萬位長輩，每五位市民就有一位。超高齡社會不是要來了，是已經來了。'),
      c('我要做「高齡安心六大檢查」：用電、防火、防災、防跌、無障礙、急難，專人到家一次看完，每戶最高補助 3 萬元[house]'),
      alt([c('75 歲以上獨居、失智失能的長輩，不用等你來，政府主動上門。')], [img('senior')], [card('homecheck')]),
      me('我媽一個人住，有人來看看我就放心了[pray]', '防跌很重要！我去年才在浴室滑倒', '做工程的人看房子，果然內行'),
      c('活得久不夠，要活得安心。'),
    ] },
  { id: 'elevator', title: '老公寓裝電梯', cat: 'purple',
    seq: [
      c('你的阿公阿嬤如果住在沒有電梯的老公寓，你一定懂我的心情。生病的長輩，只能隔著窗戶看外面。'),
      alt([img('oldstreet')], [img('elevator')], []),
      c('我想幫老公寓裝電梯。最大的難題在一樓，所以要先幫一樓解決停車，再請中央修法鬆綁[house]'),
      me('我家就住五樓沒電梯，膝蓋都快爬壞了', '有電梯，我媽就能下樓曬太陽了[sun]', '先照顧一樓，這個想法好實在'),
      c('讓行動不便的長輩出得了門，大家都方便，這叫為民興利。'),
    ] },
  { id: 'teeth', title: '全齡護牙', cat: 'purple',
    seq: [
      c('做工程四十年我學到：地基沒顧好，上面蓋再漂亮都沒用。牙齒，就是身體的地基[tooth]'),
      c('弱勢長者和 55 歲以上原住民，假牙補助最高 5 萬元；重度失能失智的長輩，牙醫走進家裡。'),
      opt(img('teeth')),
      me('假牙補助！我正需要[laugh]', '牙齒好，吃飯才香', '從小顧到老，真貼心'),
      c('缺牙補起來，飯才吃得下[smile]'),
    ] },
  { id: 'esports', title: '銀髮電競', cat: 'purple',
    seq: [
      c('我在三重輸給一群阿公阿嬤打電競，他們手速快、戰術清楚，我真的服氣[game]'),
      alt([img('esportsfun')], [img('esports')]),
      c('我要推「銀髮電競升級計畫」，再爭取第二座新北電競基地，選在捷運站旁邊。'),
      me('我也要去學！跟孫子一起打[game]', '阿公阿嬤打電競，好酷喔哈哈[laugh]', '動動腦，不會老'),
      c('電競不分年齡。該為大家爭取的，我來爭取。'),
    ] },
  { id: 'family', title: '好孕與親子', cat: 'pink',
    seq: [
      c('我穿過孕婦體驗衣，才背一下下腰就痠了。媽媽們是整整十個月，我們一定要對媽媽好一點[heart]'),
      c('好孕專車延長到孩子 1 歲；運動中心試辦親子臨托，2 小時免費；還要蓋室內大型親子館[bottle]'),
      alt([img('family')], [img('pregnancy')], [card('family')]),
      me('我媳婦正要生，這個太實用了[bottle]', '下雨天終於有地方帶孫子去玩了', '對媽媽好一點，說得真好'),
      c('願意在這裡生孩子、養孩子的家庭，才是新北最重要的地基。'),
    ] },
  { id: 'daycare', title: '校校有公托', cat: 'pink',
    seq: [
      c('新北第一所公托，民國 100 年成立的時候我有參與。現在已經 130 家了[house]'),
      c('學校有閒置教室，我要拿來設公托、公幼。爸媽不應該在生養孩子和工作之間二選一。'),
      me('孩子有人顧，年輕人才敢生', '學校旁邊就有公托，接送好方便', '我女兒一定會很開心'),
      c('朱立倫、侯友宜兩位市長的棒子，我接著跑[thumb]'),
    ] },
  { id: 'edu', title: '挺教育', cat: 'pink',
    seq: [
      c('我能有今天，是因為讀書的時候，有老師拉了我一把[book]'),
      c('現在換我做老師的靠山：打造 AI 校園、推動班班 25 人、加碼老師的心理支持。'),
      opt(img('edu')),
      me('老師真的很辛苦，謝謝川伯想到他們', '每班人少一點，孩子才被看見', '我孫子的老師聽到一定很感動'),
      c('一個城市真正的地基，是教育。'),
    ] },
  { id: 'youth', title: '第一桶金計畫', cat: 'pink',
    seq: [
      c('年輕人不缺想法，缺的是第一桶金[coin]'),
      c('青創貸款從 200 萬提高到 500 萬，團隊也能申請，還有創業導師全程陪跑。'),
      opt(img('youth')),
      me('我孫子一直想開咖啡店，我要叫他來看[tea]', '有人陪跑，年輕人比較不會走冤枉路', '500 萬！這個夠力'),
      c('有些冤枉路我走過，你就不必再走一遍。'),
    ] },
  { id: 'labor', title: '挺勞工', cat: 'teal',
    seq: [
      c('我年輕時做水電、裝冷氣，這雙手扛過冷氣、拿過鐵鎚[hammer]'),
      c('職災慰問金從 30 萬提高到 36 萬；工地高溫，風扇衣、水冷衣補助擴大；30 到 45 歲想回職場的，每月補助 5,000 元。'),
      opt(img('labor')),
      me('夏天在工地真的會中暑，謝謝川伯[sun]', '我兒子做工地的，這個很實在', '做過工的人最懂'),
      c('做過工的人，才知道工人缺什麼。'),
    ] },
  { id: 'cleaners', title: '清潔隊五承諾', cat: 'teal',
    seq: [
      c('颱風天，大家往家裡躲，清潔隊員往外走。'),
      c('我給清潔隊的承諾：夜點費從 120 提高到 200、新增早點費 100、每年免費健檢、汰換老舊垃圾車[check]'),
      opt(img('cleaners')),
      me('清潔隊員真的很辛苦，該照顧', '每天早上看到他們都很感謝', '這個讚'),
      c('台北我做過，新北我接著做。'),
    ] },
  { id: 'passport', title: '新北職人 Passport', cat: 'teal',
    seq: [
      c('很多人不知道，我開過麵包店，也烤過鳳梨酥[pineapple]'),
      c('「新北職人 Passport」：一本護照玩遍 18 家觀光工廠，集章換禮物，小朋友探索職業、長輩動手動腦。'),
      alt([img('passport')], [img('bakery')]),
      me('我要帶孫子去集章！', '週末又有地方去了[smile]', '川伯做的鳳梨酥我想吃[pineapple]'),
      c('把每一個細節做到位，就是職人精神。做糕餅是這樣，把城市做好也是。'),
    ] },
  { id: 'sports', title: '運動城市 2.0', cat: 'orange',
    seq: [
      c('新北有 20 座國民運動中心，全台最多[ball]'),
      c('我要發「新北運動幣」，一份 500 元，一年 15 萬份；還要在八里做全台第一座水陸共融運動園區。'),
      opt(img('sports')),
      me('運動幣可以去游泳嗎？我每天都去', '要動才會健康', '八里我常去騎車，太好了[bike]'),
      c('場館我來蓋，運動的習慣，大家一起養。'),
    ] },
  { id: 'tourism', title: '青春山海線 2.0', cat: 'orange',
    seq: [
      c('一天之內，你可以在九份看山、在東北角吹風、在淡水河看夜景，全部都在新北[mountain]'),
      c('瑞芳火車站旁蓋九份觀光纜車，不用塞車；深澳到貢寮蓋濱海自行車道；淡水河的遊船也要開起來[bike]'),
      alt([img('tourism')], [img('bike')], [card('tourism')]),
      me('九份纜車！我一定要帶老伴去坐', '我最愛去淡水看夕陽', '新北真的好多地方可以玩'),
      c('路，我蓋了一輩子。接下來，換我帶大家去玩[smile]'),
    ] },
  { id: 'culture', title: '文化三策', cat: 'orange',
    seq: [
      c('新北有個民族舞蹈團，57 年教了 1000 多個孩子跳舞，很多孩子後來跳到國外。'),
      c('我要發「文化幣」600 元、辦新北國際藝術節，還要讓在地團隊免場租排練[star]'),
      opt(img('culture')),
      me('文化幣可以去看戲嗎？我愛看歌仔戲', '讓孩子有舞台，好', '藝術節我一定去'),
      c('地基打穩，上面的東西才站得起來。'),
    ] },
  { id: 'hakka', title: '挺客家', cat: 'orange',
    seq: [
      c('新北有 67 萬客家鄉親，全台第二多[heart]'),
      c('哈客館要從第十一館蓋到十五館，社團補助每班最高 10 萬，義民祭辦得更大，講客語在新北不卡關。'),
      opt(img('hakka')),
      me('我是客家人！聽了好開心', '哈客館我常去上課', '客家文化要傳下去'),
      c('客家文化，不是逢年過節才想起的事，它就在新北的日常裡。'),
    ] },
  { id: 'indigenous', title: '原力新北', cat: 'orange',
    seq: [
      c('北原山貓唱歌虧我「李四川真的了不起」，說實在，我好開心，因為族人把我當自己人[laugh]'),
      c('「原力新北」四個原力：原住民社會住宅、原力廣場做大、青年創業基地、國內賽事獎金提高到 18 萬。'),
      opt(img('indigenous')),
      me('北原山貓！我最愛聽', '讓孩子有舞台，真好', '原民好，新北就好'),
      c('原民好，新北就好；原力強，新北更強[muscle]'),
    ] },
  { id: 'pets', title: '動保與毛孩', cat: 'coral',
    seq: [
      c('新北登記的毛寶貝將近 37 萬隻，全國第一[dog]'),
      c('我要蓋市立動保醫院，認養回家的毛孩基本照護免費；還有公有生命紀念園區、野生動物救傷中心。'),
      alt([img('pets')], [img('dog')], [card('pets')]),
      me('我家狗狗聽到會很開心[dog]', '毛孩也是家人', '生命紀念園區，這個好溫暖'),
      c('城市的高度，就看怎麼對待生命。'),
    ] },
  { id: 'housing', title: '居住新五箭', cat: 'blue',
    seq: [
      c('路通了，人還是要有地方可以回去。那個地方，才叫家[house]'),
      c('3.9 萬戶社會住宅我接著蓋完；捷運到哪，安居到哪；還要蓋高齡友善社宅，住在醫院附近、菜市場走得到的地方。'),
      opt(img('housing')),
      me('年輕人買不起房，這個真的需要', '住得離菜市場近，長輩最愛', '有家才安心'),
      c('一戶社宅，對一個家庭，是終於敢把行李箱放下來。'),
    ] },
  { id: 'traffic', title: '零死亡願景', cat: 'blue',
    seq: [
      c('交通最後看的，不只是蓋了多少路、多少橋[bus]'),
      c('我要做「零死亡願景」：路口、號誌一個一個改，高風險路段先處理；AI 動態號誌讓救護車先過，人行道也要接起來。'),
      me('我們家門口的人行道真的該修了', '行人安全最重要', '救護車先過，這個好'),
      c('道路安全一點，家人就多一點安心[heart]'),
    ] },
  { id: 'gender', title: '育嬰薪水補滿', cat: 'pink',
    seq: [
      c('孩子剛出生那幾個月，很多家庭都在算同一筆帳[bottle]'),
      c('請育嬰假薪水剩八成，剩下的兩成，市府補上。誰留下來顧小孩，夫妻自己商量，不用看薪水單。'),
      opt(img('gender')),
      me('這樣爸爸也可以安心請假了', '我兒子媳婦一定很需要', '這個好實在'),
      c('薪水補滿，燈裝亮，圖畫對。一件一件做。'),
    ] },
  { id: 'smokefree', title: '無菸害商圈', cat: 'coral',
    seq: [
      c('推嬰兒車的媽媽、散步的長輩，都應該有一口好空氣。'),
      c('我要打造「無菸害商圈」，蓋人性化的負壓吸菸室，第一站就在新北耶誕城[star]'),
      opt(img('smokefree')),
      me('耶誕城人那麼多，好空氣很重要', '帶孫子去看燈也安心了', '這個我支持'),
      c('新北的這口好空氣，我來做。'),
    ] },
];

// Little breathers between topics: 長輩圖, photos from the day, a glass of water.
export const INTERLUDES = [
  [c('送你一張長輩圖，祝你天天開心[flower]', '這張長輩圖送給你，記得轉給老朋友喔[flower]'), elder('morning', 'happy', 'peace', 'work', 'tea'),
    me('哈哈哈，川伯也會傳長輩圖！[laugh]', '收到！我也要轉傳給老同學', '好漂亮，我設成手機桌布了')],
  [c('跟你分享一張跑行程的照片[sun]', '這張照片我很喜歡，分享給你[sun]'), img('bike', 'mrt', 'kids', 'esportsfun', 'dog', 'bakery'),
    me('川伯看起來好有精神！', '笑得好開心喔', '要注意身體，不要太累喔')],
  [c('聊這麼久，記得喝水喔[tea]', '喝口水休息一下，我們再繼續[tea]'), me('好～川伯也要多休息', '有有有，我在喝茶[tea]'), opt(stk('chuan', 'c_ok', 'c_thumb'))],
  [c('你吃飽沒？我剛剛吃了一碗滷肉飯[smile]', '我剛吃完便當，跑行程的時候，便當最好吃[smile]'), me('吃飽了！川伯要多吃一點', '選舉很累，川伯要顧好身體')],
  [c('這張是我很喜歡的照片，你看我拳頭握多緊[muscle]', '給你看一下我的大頭照，有沒有很有精神[smile]'), img('fist', 'portrait'),
    me('好有精神！', '比電視上還帥喔', '握拳！加油加油')],
];

// Closing: thanks, a gentle reminder, the badge.
export const CLOSING = [
  me('川伯，今天聽你講了好多，覺得好有希望！', '聽完覺得新北真的會越來越好！', '川伯講得好清楚，我都聽懂了', '跟川伯聊天好開心，時間過好快'),
  c('說實在，今天跟你聊得很開心。謝謝你願意聽我這個老工程師講這麼多[heart]',
    '今天聊了好多，謝謝你陪川伯聊天[heart]',
    '說實在，能跟你這樣聊天，我很珍惜[heart]'),
  c('11 月 28 日，新北的事，交給做過的人。記得出來投票喔[check]',
    '11 月 28 日投票那天，拜託你出來投下一票，也幫我跟家人朋友說一聲[pray]',
    '新北的下一段路，我知道怎麼鋪。11 月 28 日，交給做過的人[hammer]'),
  stk('chuan', 'c_vote', 'c_bow', 'c_heart', 'c_thanks'),
  me('一定的！川伯加油[muscle]', '我會帶全家去投票！', '交給你了，川伯！', '我會跟厝邊說的！'),
  opt(stk('me', 'm_cheer', 'm_thumb', 'm_flower', 'm_moved')),
  c('這個送給你：只屬於你的「新北事民徽章」。上面的編號，就是我們今天這段對話[gift]',
    '最後送你一個禮物：「新北事民徽章」，全世界只有你這一枚[gift]'),
];

export const OUTRO = [
  c('也把這段對話分享給朋友，讓他們也來跟川伯聊聊天[smile]', '分享給你的家人朋友吧！每個人跟川伯的對話都不一樣喔[sparkle]'),
];
