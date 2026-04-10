import type { ExecutableScaleDefinition, LocalizedTextValue, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：根据原版权重生成带分数的选项
 * @param weight 该题如果选"是"对应的得分权重
 */
type ABCOptionDescriptions = [LocalizedTextValue?, LocalizedTextValue?];

const createOptions = (weight: number, descriptions?: ABCOptionDescriptions) => [
  {
    label: "否",
    score: 0,
    aliases: ["否", "没有", "未见", "基本没有", "不会", "不明显"],
    ...(descriptions?.[0] ? { description: descriptions[0] } : {}),
  },
  {
    label: "是",
    score: weight,
    aliases: ["是", "有", "会", "存在", "明显", "经常"],
    ...(descriptions?.[1] ? { description: descriptions[1] } : {}),
  }
];

// 完整 57 题 4D 结构化数据
const ABC_QUESTIONS: ScaleQuestion[] = [
  { 
    id: 1, text: '喜欢长时间的自身旋转', 
    clinical_intent: '评估前庭觉寻求行为和刻板动作模式',
    colloquial: '宝宝平时喜欢自己转圈圈吗？转很久也不觉得头晕？',
    fallback_examples: ['比如喜欢盯着旋转的风扇看吗？'],
    options: createOptions(4, [
      '基本没有长时间自己旋转或盯着旋转物看的情况，转一会儿就会停下来。',
      '经常长时间自己转圈，或明显迷恋旋转刺激，转很久也不容易停下。'
    ]) 
  },
  { 
    id: 2, text: '学会做一件简单的事，但是很快就"忘记"', 
    clinical_intent: '评估工作记忆和技能维持能力',
    colloquial: '宝宝教他做件简单的事，比如把垃圾扔进垃圾桶，他是不是很快就好像忘了怎么做？',
    fallback_examples: ['是不是感觉他学东西一阵一阵的，今天会了明天又不会了？'],
    options: createOptions(2, [
      '刚学会的简单事情大多能保持，不会很快就像没学过一样。',
      '刚学会一件简单的事很快又忘掉，常常需要反复重新教。'
    ]) 
  },
  { 
    id: 3, text: '经常没有接触环境或进行交往的要求', 
    clinical_intent: '评估社交发起和探索环境的动机',
    colloquial: '宝宝是不是很少主动去找别的小朋友玩，或者对周围的新鲜事物没什么兴趣？',
    fallback_examples: ['带他去公园，他是不是宁愿自己待着，也不去凑热闹？'],
    options: createOptions(4, [
      '平时会主动接触周围的人和环境，对新鲜事物也有基本兴趣。',
      '很少主动接触周围的人或环境，对新鲜事物和社交活动明显缺乏兴趣。'
    ]) 
  },
  { 
    id: 4, text: '不能执行只说一遍的简单的指令(如坐下、来这儿等)', 
    clinical_intent: '评估听觉信息处理和指令服从',
    colloquial: '您平时叫他“过来”或者“坐下”，只说一遍他听吗？',
    fallback_examples: ['是不是经常得说好几遍，或者得拉着他去做才行？'],
    options: createOptions(2, [
      '简单指令说一遍大多能听懂并执行，不太需要重复提醒。',
      '简单指令经常说一遍没有反应，往往需要反复提醒或直接拉着去做。'
    ]) 
  },
  { 
    id: 5, text: '不会玩玩具等(如没完没了地转动或乱扔、揉等)', 
    clinical_intent: '评估功能性游戏能力及是否存在刻板玩法',
    colloquial: '宝宝玩玩具的时候，会正常玩吗？比如拿小汽车在地上推。',
    fallback_examples: ['他是不是只会把玩具拿在手里转，或者就是乱扔、乱敲？'],
    options: createOptions(4, [
      '会按玩具本来的用途玩，较少出现只转、乱扔或反复揉搓的情况。',
      '不会按正常方式玩玩具，经常只顾转动、乱扔、反复揉搓或做单调动作。'
    ]) 
  },
  { 
    id: 6, text: '视觉辨别能力差(专注于物体的细微特征 大小、颜色或位置)', 
    clinical_intent: '评估局部视觉偏好及过度关注细节',
    colloquial: '宝宝是不是特别喜欢盯着东西的某个小地方看？比如只看小汽车的轮子。',
    fallback_examples: ['他会对东西的颜色或者摆放位置有特别死板的要求吗？'],
    options: createOptions(3, [
      '看东西时能较完整地看整体，不太会只盯着某个小细节不放。',
      '经常只盯着物体的局部细节，或对颜色、位置等细微变化特别死板。'
    ]) 
  },
  { 
    id: 7, text: '无交往性微笑(无社交性微笑，即不会与人点头、招呼、微笑)', 
    clinical_intent: '评估社交互动中的情感共鸣',
    colloquial: '看到熟人或者您逗他的时候，他会看着您主动微笑吗？',
    fallback_examples: ['别人冲他笑或者打招呼，他有反应吗？'],
    options: createOptions(4, [
      '看到熟人、被逗时通常会有自然的社交微笑、点头或回应。',
      '很少对人露出社交性微笑，别人逗他、招呼他时也常没有回应。'
    ]) 
  },
  { 
    id: 8, text: '代词运用的颠倒或混乱(如反"你"说成"我"等等)', 
    clinical_intent: '评估语言发育中的代词反转现象',
    colloquial: '宝宝说话的时候，“你”、“我”、“他”是不是经常分不清？',
    fallback_examples: ['比如他想要饼干，是不是说“你要吃饼干”，而不是“我要吃饼干”？'],
    options: createOptions(3, [
      '“你、我、他”等代词大多能用对，不太会把称呼弄混。',
      '经常把“你、我、他”说反或混用，别人需要根据情境去猜他的意思。'
    ]) 
  },
  { 
    id: 9, text: '长时间的总拿着某件东西', 
    clinical_intent: '评估对特定物品的异常依恋',
    colloquial: '宝宝是不是总喜欢手里攥着个特定的东西不肯放？比如一根小棍或者一块布。',
    fallback_examples: ['拿走这个东西他是不是会特别发脾气？'],
    options: createOptions(3, [
      '不会长时间一直攥着某个固定物品，拿开后通常也能接受。',
      '经常长时间攥着某个固定物品不放，拿走后容易强烈不安或发脾气。'
    ]) 
  },
  { 
    id: 10, text: '似乎不在听人说话，以致怀疑他/她有听力问题', 
    clinical_intent: '评估对社交声音的忽视（听而不闻）',
    colloquial: '有时候您跟他说话，他是不是完全没反应，就跟听不见一样？',
    fallback_examples: ['您有没有曾经怀疑过他耳朵听力有问题？'],
    options: createOptions(3, [
      '大人跟他说话时大多会有反应，不会总让人怀疑听不见。',
      '经常像完全没在听人说话一样，对呼唤和讲话反应很弱。'
    ]) 
  },
  { 
    id: 11, text: '说话不含语调、无抑扬顿挫、无节奏', 
    clinical_intent: '评估言语的韵律异常（机械音/平铺直叙）',
    colloquial: '宝宝说话的时候，声音是不是平平的，没什么感情，像机器人一样？',
    fallback_examples: ['高兴或者生气的时候，听他说话的语气有变化吗？'],
    options: createOptions(4, [
      '说话语调相对自然，能听出高兴、生气或提问等变化。',
      '说话常像机器人一样平平的，缺少抑扬顿挫和自然节奏。'
    ]) 
  },
  { 
    id: 12, text: '长时间的摇摆身体', 
    clinical_intent: '评估本体觉寻求和自我刺激行为',
    colloquial: '宝宝坐着或站着的时候，会经常长时间地前后摇晃身体吗？',
    fallback_examples: ['发呆或者无聊的时候，摇晃身体的动作明显吗？'],
    options: createOptions(4, [
      '平时很少长时间前后摇晃身体，身体动作相对自然。',
      '经常长时间摇摆身体，尤其在发呆、兴奋或无聊时更明显。'
    ]) 
  },
  { 
    id: 13, text: '要去拿什么东西，但又不是身体所能达到的地方(即对自身与物体距离估计不足)', 
    clinical_intent: '评估深度知觉和空间距离判断',
    colloquial: '他去抓东西的时候，会不会经常抓空？明明够不着还非要去够？',
    fallback_examples: ['感觉他对东西离自己有多远是不是判断不太准？'],
    options: createOptions(2, [
      '拿东西时距离判断大致正常，不太会频繁抓空或硬够。',
      '经常抓空、够错位置，明显不太会判断自己和物体的距离。'
    ]) 
  },
  { 
    id: 14, text: '对外界环境微小的变化和日常生活规律的改变产生强烈反应', 
    clinical_intent: '评估对同一性的坚持和环境改变的不耐受',
    colloquial: '如果家里家具换个位置，或者突然改变了每天的出门路线，他会发很大脾气吗？',
    fallback_examples: ['他对每天做事的顺序是不是有严格的要求，不能打乱？'],
    options: createOptions(3, [
      '对生活小变化大多能接受，顺序被打乱也不至于强烈失控。',
      '对细小变化非常敏感，路线、顺序或摆放一变就容易强烈反应。'
    ]) 
  },
  { 
    id: 15, text: '当他和其他人一起被叫到名字时，对呼唤他的名字无反应', 
    clinical_intent: '评估社交注意力及名字呼唤反应',
    colloquial: '在一群人里，您或者别人大声叫他的名字，他会抬头看吗？',
    fallback_examples: ['还是得走到他跟前拍他，他才有反应？'],
    options: createOptions(2, [
      '在多人一起被叫名字时，大多能听到并回头或作出反应。',
      '在多人场景中常对叫自己名字没有反应，好像完全没听见。'
    ]) 
  },
  { 
    id: 16, text: '经常做出猛冲、旋转、脚尖行走、拍手等动作', 
    clinical_intent: '评估大运动相关的刻板行为',
    colloquial: '平时经常看到他突然猛冲、垫着脚尖走路或者毫无意义地拍手吗？',
    fallback_examples: ['一兴奋或者紧张的时候，这些动作多吗？'],
    options: createOptions(4, [
      '很少出现猛冲、原地旋转、踮脚走路或反复拍手等明显刻板动作。',
      '经常出现猛冲、旋转、踮脚、拍手等重复动作，兴奋或紧张时更明显。'
    ]) 
  },
  { 
    id: 17, text: '对其他人的面部表情或情感没有反应', 
    clinical_intent: '评估面部表情解读和共情能力',
    colloquial: '您装作很疼或者很生气的样子，他能看出来并且有反应吗？',
    fallback_examples: ['别人哭的时候，他会关心，还是像没看见一样？'],
    options: createOptions(3, [
      '能注意到别人脸上的表情和情绪变化，多少会作出对应反应。',
      '对别人哭、笑、生气等面部表情和情绪变化常显得没反应。'
    ]) 
  },
  { 
    id: 18, text: '说话时很少用"是"或"我"等词', 
    clinical_intent: '评估自我意识和确认表达',
    colloquial: '他平时说话，会用“我”这个字吗？回答问题会清楚地说“是”吗？',
    fallback_examples: ['问他吃不吃苹果，他会怎么回答？'],
    options: createOptions(2, [
      '说话时会自然使用“我”“是”等基础词语，表达较清楚。',
      '说话时很少使用“我”“是”等词，回答问题也常不清楚或缺失。'
    ]) 
  },
  { 
    id: 19, text: '有某一方面的特殊能力，似乎与智力低下不相符合', 
    clinical_intent: '评估孤岛能力（如机械记忆、数字拼图等）',
    colloquial: '宝宝在某一方面是不是特别厉害，比如认车标、记数字或者拼图？',
    fallback_examples: ['这种能力是不是远超同龄孩子，但其他普通生活技能却不太行？'],
    options: createOptions(4, [
      '整体能力发展相对均衡，没有特别突出的孤岛式能力表现。',
      '某些方面显得特别强，但和整体发展水平很不相称，像有孤岛能力。'
    ]) 
  },
  { 
    id: 20, text: '不能执行简单的含有介词的指令(如把球放在盒子上或把球放在盒子里)', 
    clinical_intent: '评估对空间方位介词的理解',
    colloquial: '您让他“把玩具放在桌子底下”或者“放在盒子里”，他能放对位置吗？',
    fallback_examples: ['他是不是分不清“上、下、里、外”？'],
    options: createOptions(2, [
      '对“上、下、里、外”等方位词大多能理解并照着做。',
      '经常听不懂带方位词的简单指令，容易把位置放错。'
    ]) 
  },
  { 
    id: 21, text: '有时对很大的声音不产生吃惊的反应(可能让人想到儿童是聋子)', 
    clinical_intent: '评估听觉反应迟钝',
    colloquial: '旁边突然有个很大的声音，比如摔了个碗，他会被吓一跳吗？',
    fallback_examples: ['是不是有时候多大的声音他都没反应，完全不怕？'],
    options: createOptions(3, [
      '遇到很大的声音通常会被吓到或至少有明显反应，不像完全没听见。',
      '面对很大的声音时常没有吃惊反应，让人感觉听觉反应明显偏弱。'
    ]) 
  },
  { 
    id: 22, text: '经常拍打手(或其他自我刺激的行为)', 
    clinical_intent: '评估刻板的自我刺激行为',
    colloquial: '他平时无聊或者兴奋的时候，会频繁地拍手或者挥舞双手吗？',
    fallback_examples: ['除了拍手，还有没有其他的重复小动作？'],
    options: createOptions(4, [
      '很少用拍手、挥手等方式来自我刺激，动作模式相对自然。',
      '经常反复拍手、挥手或做类似自我刺激的小动作。'
    ]) 
  },
  { 
    id: 23, text: '发大脾气或经常发点小脾气', 
    clinical_intent: '评估情绪调节能力',
    colloquial: '宝宝是不是脾气很大，动不动就发脾气哭闹？',
    fallback_examples: ['很难哄好吗？'],
    options: createOptions(2, [
      '情绪波动相对可控，偶有不高兴也不至于经常大发脾气。',
      '经常因为小事发脾气、哭闹或情绪爆发，很难安抚下来。'
    ]) 
  },
  { 
    id: 24, text: '主动回避与别人进行眼光接触', 
    clinical_intent: '评估眼神对视的缺失或主动逃避',
    colloquial: '您跟他说话的时候，他会看您的眼睛吗？',
    fallback_examples: ['他是不是故意躲开别人的眼神，不跟人对视？'],
    options: createOptions(4, [
      '和人说话时通常会看对方眼睛，不太会主动躲开视线。',
      '经常主动回避眼神接触，说话时明显不愿意和别人对视。'
    ]) 
  },
  { 
    id: 25, text: '拒绝别人接触或拥抱', 
    clinical_intent: '评估触觉防御及身体亲密接触回避',
    colloquial: '您或者家里人想抱抱他，他会推开或者显得很抗拒吗？',
    fallback_examples: ['是不是不喜欢别人碰到他？'],
    options: createOptions(4, [
      '一般能接受家人拥抱或触碰，不会明显排斥身体接触。',
      '经常拒绝被抱、被摸，别人一接触就明显抗拒或推开。'
    ]) 
  },
  { 
    id: 26, text: '有时对很痛苦的刺激(如摔伤、割破或注射)不引起反应', 
    clinical_intent: '评估痛觉迟钝',
    colloquial: '他摔了一跤或者打针的时候，是不是不太怕疼，也不怎么哭？',
    fallback_examples: ['有时候磕青了，他自己都没察觉？'],
    options: createOptions(3, [
      '对摔伤、打针等疼痛刺激通常会有和年龄相符的反应。',
      '对明显疼痛刺激反应偏弱，摔伤、割破或打针时也常不太在意。'
    ]) 
  },
  { 
    id: 27, text: '身体表现很僵硬很难抱住(如打挺)', 
    clinical_intent: '评估肌张力异常及拥抱姿态抗拒',
    colloquial: '抱他的时候，他是不是经常往后打挺，身体绷得直直的，很难抱？',
    fallback_examples: ['感觉像块木板一样僵硬吗？'],
    options: createOptions(3, [
      '被抱起时身体姿势相对自然，不会总是打挺或僵直反抗。',
      '被抱时常常打挺、僵硬，身体绷得很直，明显不好抱。'
    ]) 
  },
  { 
    id: 28, text: '当抱着他时，感到他肌肉松弛(即他不紧贴着抱他的人)', 
    clinical_intent: '评估拥抱时的低肌张力或缺乏姿势依附',
    colloquial: '您抱他的时候，他是不是软绵绵的，不会主动搂着您的脖子贴紧您？',
    fallback_examples: ['感觉像抱了个布娃娃一样？'],
    options: createOptions(2, [
      '被抱着时会自然贴近抱他的人，有一定依附和配合姿势。',
      '被抱时身体常软绵绵的，不会主动贴近或抱住抱他的人。'
    ]) 
  },
  { 
    id: 29, text: '想要什么东西时，以姿势、手势表示(而不倾向用语言表示)', 
    clinical_intent: '评估非言语沟通偏好',
    colloquial: '他想要吃东西，是自己去拉您的手去拿，还是张嘴说话要？',
    fallback_examples: ['是不是能用手指或者拉人，就不愿意开口说话？'],
    options: createOptions(2, [
      '想要东西时会尝试用语言表达，不只是拉手或比划。',
      '想要东西时更依赖姿势和手势，不太愿意用语言说出来。'
    ]) 
  },
  { 
    id: 30, text: '常用脚尖走路', 
    clinical_intent: '评估异常步态及本体觉刺激',
    colloquial: '他走路的时候，是不是经常垫着脚尖走？',
    fallback_examples: ['平时在家里不穿鞋的时候更明显吗？'],
    options: createOptions(3, [
      '走路姿势大多正常，不会经常长期踮着脚尖走。',
      '常常踮着脚尖走路，这种异常步态比较明显。'
    ]) 
  },
  { 
    id: 31, text: '用咬人、撞人、踢人等来伤害他人', 
    clinical_intent: '评估攻击性行为',
    colloquial: '他一生气或者着急，会不会去咬人、撞人或者踢人？',
    fallback_examples: ['这种情况经常发生吗？'],
    options: createOptions(2, [
      '生气或着急时一般不会通过咬人、撞人、踢人来伤害别人。',
      '一着急或发怒就容易用咬人、撞人、踢人等方式攻击他人。'
    ]) 
  },
  { 
    id: 32, text: '一遍一遍不断地重复短句', 
    clinical_intent: '评估刻板言语及延迟仿言',
    colloquial: '他会不会总是在嘴里反复嘟囔某一句动画片台词，或者同一句话？',
    fallback_examples: ['是不是完全不在聊天的情境下，自己在那儿重复？'],
    options: createOptions(3, [
      '不会无意义地反复重复同一句短句或台词，语言更有交流目的。',
      '经常一遍遍重复同一句短句或台词，即使当下并不需要交流。'
    ]) 
  },
  { 
    id: 33, text: '游戏时不模仿其他儿童', 
    clinical_intent: '评估社交模仿能力缺失',
    colloquial: '跟别的小朋友一起玩的时候，别人在玩什么，他会跟着学吗？',
    fallback_examples: ['是不是别人玩别人的，他只顾玩自己的？'],
    options: createOptions(4, [
      '和别的孩子一起玩时会观察并模仿对方的玩法。',
      '游戏时很少模仿其他儿童，更像各玩各的，缺少跟随学习。'
    ]) 
  },
  { 
    id: 34, text: '当强光直接照射眼睛时常常不眨眼', 
    clinical_intent: '评估视觉反应迟钝及异常',
    colloquial: '突然有手电筒或者太阳强光晃到眼睛，他会马上眨眼或者闭眼吗？',
    fallback_examples: ['他是不是有时候对强光毫无反应，甚至还盯着看？'],
    options: createOptions(3, [
      '强光照到眼睛时通常会眨眼、躲开或做出保护反应。',
      '强光直接照到眼睛时也常不眨眼、不躲开，视觉反应明显异常。'
    ]) 
  },
  { 
    id: 35, text: '以撞头、咬手等行为来自伤', 
    clinical_intent: '评估自伤行为',
    colloquial: '他一着急或者发脾气，会不会用头撞墙，或者自己咬自己的手？',
    fallback_examples: ['身上有因为自己弄伤留下的痕迹吗？'],
    options: createOptions(3, [
      '不会用撞头、咬手等方式伤害自己，情绪激动时也较少自伤。',
      '一着急或发脾气就可能撞头、咬手等，出现明显自伤行为。'
    ]) 
  },
  { 
    id: 36, text: '想要什么东西不能等待(一想要什么就马上要得到什么)', 
    clinical_intent: '评估延迟满足能力缺失',
    colloquial: '他想要一个东西，是不是必须马上拿到，让他等一分钟都不行？',
    fallback_examples: ['如果不马上给他，是不是立刻就崩溃大哭？'],
    options: createOptions(2, [
      '想要东西时基本还能等待一下，不一定马上得到才行。',
      '一想到要什么就必须立刻得到，几乎不能等待或延后满足。'
    ]) 
  },
  { 
    id: 37, text: '不能指出5个以上物体的名称', 
    clinical_intent: '评估指物命名能力和词汇量',
    colloquial: '您问他“苹果在哪”、“小狗在哪”，他能用手指出来至少5样常见的东西吗？',
    fallback_examples: ['他认识的东西多吗？'],
    options: createOptions(2, [
      '能指出不少常见物体名称，至少能认出并指出 5 样以上东西。',
      '连 5 个以上常见物体名称都很难指出来，指物理解明显不足。'
    ]) 
  },
  { 
    id: 38, text: '不能发展任何友谊(不会和小朋友来往交朋友)', 
    clinical_intent: '评估同伴关系建立能力',
    colloquial: '他在幼儿园或者小区里，有玩得特别好的固定小伙伴吗？',
    fallback_examples: ['是不是基本上不怎么理其他小孩，都是各玩各的？'],
    options: createOptions(4, [
      '能逐渐和同龄孩子建立来往，不是完全没有朋友关系。',
      '很难发展任何友谊，基本不会和小朋友来往或交朋友。'
    ]) 
  },
  { 
    id: 39, text: '有许多声音的时候常常盖着耳朵', 
    clinical_intent: '评估听觉敏感及防御',
    colloquial: '外面如果有电钻声、汽车喇叭声，他会立刻用手捂住耳朵吗？',
    fallback_examples: ['在人很多、很吵的地方，他会表现得很害怕、捂耳朵吗？'],
    options: createOptions(3, [
      '环境吵闹时通常还能承受，不会经常立刻捂住耳朵。',
      '一有很多声音就常捂耳朵，对噪音表现出明显敏感和不适。'
    ]) 
  },
  { 
    id: 40, text: '经常旋转碰撞物体', 
    clinical_intent: '评估对物品的刻板操作',
    colloquial: '他是不是特别喜欢把各种东西放在地上转，或者拿着东西瞎敲瞎碰？',
    fallback_examples: ['比如喜欢转盘子、转盖子？'],
    options: createOptions(3, [
      '很少反复去旋转、碰撞物体，玩东西的方式较自然。',
      '经常旋转、碰撞物体，明显沉迷于这种重复操作。'
    ]) 
  },
  { 
    id: 41, text: '在训练大小便方面有困难(不会控制住小便)', 
    clinical_intent: '评估生活自理能力及如厕训练延迟',
    colloquial: '宝宝现在会自己控制大小便吗？还是经常尿裤子？',
    fallback_examples: ['教他上厕所是不是特别困难？'],
    options: createOptions(2, [
      '大小便控制和如厕训练大致符合年龄，不会长期明显困难。',
      '如厕训练明显困难，常不会控制小便或长期频繁尿裤子。'
    ]) 
  },
  { 
    id: 42, text: '一天只能提出5个以内的要求', 
    clinical_intent: '评估主动沟通的频率',
    colloquial: '他一天主动找您要东西或者帮忙的次数多吗？能有五次吗？',
    fallback_examples: ['是不是非常少主动找大人提需求？'],
    options: createOptions(2, [
      '一天里会多次主动表达需要，不止局限在很少几次。',
      '一天主动提出的要求非常少，常常 5 次以内就结束了。'
    ]) 
  },
  { 
    id: 43, text: '经常受到惊吓或非常焦虑不安', 
    clinical_intent: '评估情绪状态与焦虑水平',
    colloquial: '宝宝平时是不是很容易受到惊吓，或者看起来总是很紧张、很不安？',
    fallback_examples: ['一点小动静就会让他很害怕吗？'],
    options: createOptions(3, [
      '平时不算特别容易受惊，也不会经常显得高度焦虑不安。',
      '经常容易受惊或明显焦虑不安，情绪紧绷感比较持续。'
    ]) 
  },
  { 
    id: 44, text: '在正常光线下眯眼、皱眉或遮住眼睛', 
    clinical_intent: '评估视觉敏感',
    colloquial: '在正常的房间灯光或者白天外面，他会经常眯着眼睛或者拿手遮眼睛吗？',
    fallback_examples: ['感觉他是不是很怕亮光？'],
    options: createOptions(2, [
      '在正常光线下不会经常眯眼、皱眉或拿手遮眼睛。',
      '正常光线下也常眯眼、皱眉或遮眼，表现出明显怕光。'
    ]) 
  },
  { 
    id: 45, text: '不是经常帮助的话，不会自己给自己穿衣', 
    clinical_intent: '评估穿衣自理能力延迟',
    colloquial: '穿衣服、穿裤子这些事，如果不帮忙，他能自己穿好吗？',
    fallback_examples: ['是不是完全依赖大人帮忙穿？'],
    options: createOptions(1, [
      '在提醒或少量帮助下，基本能尝试自己穿衣，不完全依赖大人。',
      '如果没有经常帮助，通常不会自己穿衣，穿衣自理明显落后。'
    ]) 
  },
  { 
    id: 46, text: '一遍一遍重复一些声音或词', 
    clinical_intent: '评估无意义的刻板发音',
    colloquial: '他会不会总是没完没了地发出同一个怪声音，或者重复同一个词？',
    fallback_examples: ['没有任何沟通意义地自己嘟囔？'],
    options: createOptions(4, [
      '不会无意义地反复发同一种声音或重复同一个词。',
      '经常一遍遍重复同一种声音或同一个词，缺少实际沟通意义。'
    ]) 
  },
  { 
    id: 47, text: '瞪着眼看人，好象要"看穿"似的', 
    clinical_intent: '评估异常的眼神凝视',
    colloquial: '他看人的时候，眼神会不会直勾勾的，盯着看很久，让人感觉有点奇怪？',
    fallback_examples: ['不像正常的眼神交流，更像是瞪着看？'],
    options: createOptions(4, [
      '看人时眼神交流大体自然，不会总是直勾勾盯着别人看。',
      '看人时常直勾勾地瞪视，像要把人“看穿”一样，显得不自然。'
    ]) 
  },
  { 
    id: 48, text: '重复别人的问话和回答', 
    clinical_intent: '评估即时仿言（鹦鹉学舌）',
    colloquial: '您问他“吃不吃饭？”，他是不是不回答“吃”，而是跟着学您说“吃不吃饭”？',
    fallback_examples: ['就像个小鹦鹉一样重复您刚才的话？'],
    options: createOptions(4, [
      '通常会按问题意思回答，不会总是原样重复别人的问话。',
      '经常把别人刚说的话原样重复出来，像鹦鹉学舌一样答非所问。'
    ]) 
  },
  { 
    id: 49, text: '经常察觉不到所处的环境，并且可能意识不到危险情况', 
    clinical_intent: '评估危险意识缺失和环境抽离感',
    colloquial: '在马路上或者高的地方，他是不是完全不知道害怕危险？',
    fallback_examples: ['感觉他整个人沉浸在自己的世界里，不管周围发生什么？'],
    options: createOptions(2, [
      '对周围环境和危险大多有察觉，不会明显脱离情境。',
      '经常察觉不到周围环境和危险，像沉浸在自己世界里一样。'
    ]) 
  },
  { 
    id: 50, text: '特别喜欢摆弄并着迷于单调的东西或游戏、活动等(如来回的走或跑、没完没了地蹦、跳、拍敲)', 
    clinical_intent: '评估狭隘的兴趣和刻板动作',
    colloquial: '他是不是会长时间重复做一件很单调的事？比如没完没了地开关门、来回跑或者一直敲桌子？',
    fallback_examples: ['怎么叫他都不停？'],
    options: createOptions(4, [
      '不会长时间沉迷于单调重复的活动，叫停后一般能转移。',
      '特别着迷于单调重复的游戏或活动，常常怎么叫都停不下来。'
    ]) 
  },
  { 
    id: 51, text: '对周围东西喜欢触摸、嗅和/或尝', 
    clinical_intent: '评估异常的感官探索方式',
    colloquial: '拿到一个新东西，他是不是第一时间去闻一闻，或者放在嘴里舔一舔、咬一咬？',
    fallback_examples: ['喜欢摸各种奇怪材质的东西吗？'],
    options: createOptions(3, [
      '接触新东西时一般不会总靠闻、舔、尝来探索，方式较正常。',
      '经常通过触摸、嗅闻、舔或尝来探索周围东西，方式明显异常。'
    ]) 
  },
  { 
    id: 52, text: '对生人常无视觉反应(对来人不看)', 
    clinical_intent: '评估对陌生人的社交忽视',
    colloquial: '家里来了不认识的客人，他会看人家一眼吗？',
    fallback_examples: ['是不是完全当人家不存在，头都不抬？'],
    options: createOptions(3, [
      '有生人来时通常会看一眼或留意，不至于完全无视对方。',
      '对生人常常几乎没有视觉反应，来人了也像没看见一样。'
    ]) 
  },
  { 
    id: 53, text: '纠缠在一些复杂的仪式行为上(如走路一定要走一定的路线，饭前或睡前等一定要把东西摆在特定地方或做特定动作)', 
    clinical_intent: '评估复杂的仪式化刻板行为',
    colloquial: '他是不是有一些必须要遵守的“死规矩”？比如出门必须走同一条路，或者睡觉前玩具必须摆成一条直线？',
    fallback_examples: ['如果规矩被破坏了，他是不是会大发脾气？'],
    options: createOptions(4, [
      '没有必须反复执行的复杂仪式动作，规则被打乱也还能适应。',
      '常纠缠于复杂的仪式化行为，路线、摆放或动作被打破就会强烈反应。'
    ]) 
  },
  { 
    id: 54, text: '经常毁坏东西(如玩具、家庭物品很快就弄坏)', 
    clinical_intent: '评估破坏性行为',
    colloquial: '家里的玩具或者东西，是不是到他手里很快就被摔坏或者拆坏了？',
    fallback_examples: ['是不是不懂得爱惜东西？'],
    options: createOptions(2, [
      '一般不会经常无故弄坏玩具或家里的东西，物品损坏不算突出。',
      '经常把玩具或家庭物品很快弄坏，破坏性行为比较明显。'
    ]) 
  },
  { 
    id: 55, text: '在2岁半以前就发现该儿童发育延迟', 
    clinical_intent: '评估发育异常的起病年龄',
    colloquial: '您是不是在宝宝两岁半之前，就觉得他比别的小孩发育得慢，不太对劲？',
    fallback_examples: ['比如说话晚，或者走路晚？'],
    options: createOptions(1, [
      '在 2 岁半以前没有明显发现发育比同龄孩子落后的情况。',
      '在 2 岁半以前就已经明显发现发育落后或“不太对劲”的迹象。'
    ]) 
  },
  { 
    id: 56, text: '在日常生活中至今仅会用15个以上、30个以下的短句进行交流', 
    clinical_intent: '评估表达性语言的严重受损',
    colloquial: '宝宝到现在为止，平时能说出来的句子，是不是非常少，加起来也就一二十句左右？',
    fallback_examples: ['很少能用长句子完整表达自己的意思？'],
    options: createOptions(3, [
      '日常交流句子数量已明显超过这个范围，表达能力不止十几二十句短句。',
      '到现在仍只能用很少的短句交流，日常可说的句子数量非常有限。'
    ]) 
  },
  { 
    id: 57, text: '长期凝视一个地方(呆呆地看一处)', 
    clinical_intent: '评估发呆及视觉沉浸',
    colloquial: '他会不会经常盯着一个地方，比如墙角或者地板发呆，看很久都不动？',
    fallback_examples: ['叫他好几声都回不过神来？'],
    options: createOptions(4, [
      '不会经常长时间盯着一个地方发呆，被叫时通常能较快回神。',
      '经常长期盯着一个地方发呆，叫很多声也不容易回过神来。'
    ]) 
  }
];

export const ABC_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "ABC",
  version: "1.0",  // ✅ 新增版本号
  title: {
    zh: "孤独症行为评定量表 (ABC)",
    en: "Autism Behavior Checklist (ABC)"
  },
  description: {
    zh: "用于筛查和评估儿童孤独症的严重程度，包含感觉、交往、躯体运动、语言和生活自理五个维度的异常表现。",
    en: "A screening and assessment scale for autism-related behaviors across sensory, social, motor, language, and self-care domains."
  },
  category: "Child Development",
  tags: ["儿童发育", "孤独症", "自闭症", "筛查"],
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: true,
  questions: ABC_QUESTIONS,
  
  // 算分逻辑：由于权重已经内置在 answers 的 score 中，只需简单求和
  calculateScore: (answers: number[]) => {
    const totalScore = answers.reduce((sum, score) => sum + score, 0);
    
    let conclusion: string;
    let details = { level: "", description: "" };

    if (totalScore >= 68) {
      conclusion = "高度疑似";
      details = {
        level: "高度疑似",
        description: "孤独症相关行为特征非常明显，强烈建议立即前往儿童精神科或发育行为科进行专业临床医学评估。"
      };
    } else if (totalScore >= 53) {
      conclusion = "边缘/疑似界限";
      details = {
        level: "边缘/疑似界限",
        description: "存在较多孤独症相关特征，具有一定的临床风险，建议尽快咨询专业医生做进一步的筛查与观察。"
      };
    } else {
      conclusion = "正常范围/非典型";
      details = {
        level: "正常范围/非典型",
        description: "目前评估总分未达到典型的孤独症筛查界限，但若家长仍对孩子的发育有疑虑，建议保持日常观察。"
      };
    }

    return { totalScore, conclusion, details };
  }
};
