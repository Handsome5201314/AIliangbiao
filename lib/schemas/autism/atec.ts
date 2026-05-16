import type { ExecutableScaleDefinition, LocalizedTextValue, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：生成 ATEC 模块 I (语言) 和 模块 III (感知觉) 的选项
 * 正向能力题：越符合说明能力越强，得分越低（0分代表正常，2分代表严重问题）
 */
const createPositiveAbilityOptions = () => [
  { label: "非常符合", score: 0, description: "孩子具备该项能力" },
  { label: "有点符合", score: 1, description: "能力表现不稳定或较弱" },
  { label: "不符合", score: 2, description: "几乎不具备该项能力" }
];

/**
 * 辅助函数：生成 ATEC 模块 II (社交) 的选项
 * 负面表现题：越符合说明症状越重，得分越高（0分代表正常，2分代表严重问题）
 */
const createNegativeSymptomOptions = () => [
  { label: "不符合", score: 0, description: "没有这种异常表现" },
  { label: "有点符合", score: 1, description: "偶尔或轻微有此表现" },
  { label: "非常符合", score: 2, description: "该异常表现非常明显" }
];

/**
 * 辅助函数：生成 ATEC 模块 IV (行为/生理) 的选项
 * 问题严重程度：4级计分
 */
const createBehaviorOptions = () => [
  { label: "不是问题", score: 0 },
  { label: "小问题", score: 1 },
  { label: "有点问题", score: 2 },
  { label: "有严重问题", score: 3 }
];

// ATEC 全量 77 题 4D 结构化数据
const ATEC_QUESTIONS: ScaleQuestion[] = [
  // ================= 维度 I：表达/语言沟通 (1-14题) 计分：不符合(2), 有点符合(1), 非常符合(0) =================
  { id: 1, text: '知道自己的名字', clinical_intent: '评估自我认知与名字听觉反馈', colloquial: '宝宝现在知道自己的名字叫什么吗？', fallback_examples: ['您喊他的大名或者小名，他知道是在叫自己吗？'], options: createPositiveAbilityOptions() },
  { id: 2, text: '对“不”或“停”有反应', clinical_intent: '评估对否定或禁止性指令的理解', colloquial: '您跟他说“不行”或者“停下”的时候，他有反应吗？', fallback_examples: ['他会乖乖停下手里的动作吗？'], options: createPositiveAbilityOptions() },
  { id: 3, text: '能够听从一些指令', clinical_intent: '评估对日常指令的服从度', colloquial: '他能听懂并且照做一些简单的日常指令吗？', fallback_examples: ['比如您跟他说“去把鞋子拿过来”，他能办到吗？'], options: createPositiveAbilityOptions() },
  { id: 4, text: '能1次说1个字(如：不、吃、水等)', clinical_intent: '评估单字发音表达能力', colloquial: '他能清楚地单蹦出一个字来表达意思吗？', fallback_examples: ['比如要喝水的时候，能主动说一个“水”字吗？'], options: createPositiveAbilityOptions() },
  { id: 5, text: '能1次说2个字(如：不要、回家)', clinical_intent: '评估双字词汇表达能力', colloquial: '他现在能连着说两个字组成的词了吗？', fallback_examples: ['比如“不要”、“回家”、“抱抱”？'], options: createPositiveAbilityOptions() },
  { id: 6, text: '能1次说3个字(如：还要水）', clinical_intent: '评估三字短语表达能力', colloquial: '能说三个字的小短句吗？', fallback_examples: ['比如“我要吃”、“看狗狗”？'], options: createPositiveAbilityOptions() },
  { id: 7, text: '知道10个或以上的词', clinical_intent: '评估主动词汇量规模', colloquial: '他现在能主动说出并且明白意思的词，加起来能有10个以上了吗？', fallback_examples: ['不论是名词还是动词都算上。'], options: createPositiveAbilityOptions() },
  { id: 8, text: '会说包含4个或4个以上字的句子', clinical_intent: '评估完整句子表达能力', colloquial: '他现在能说四个字以上的完整句子吗？', fallback_examples: ['比如“我要吃苹果”或者更长的话。'], options: createPositiveAbilityOptions() },
  { id: 9, text: '能说清楚他/她想要什么', clinical_intent: '评估需求表达的主动性与清晰度', colloquial: '他想要什么东西的时候，能用嘴巴清楚地告诉您他要什么吗？', fallback_examples: ['而不是只会拉着您的手去够？'], options: createPositiveAbilityOptions() },
  { id: 10, text: '问一些有意义的问题', clinical_intent: '评估主动提问的语用能力', colloquial: '他平时会主动向您提问吗？', fallback_examples: ['比如好奇地问“这是什么？”或者“为什么呀？”'], options: createPositiveAbilityOptions() },
  { id: 11, text: '说话趋于有意义或相关联', clinical_intent: '评估言语连贯性及语境相关性', colloquial: '他平时说话的内容，是就事论事有意义的，还是经常瞎嘟囔一些没边儿的话？', fallback_examples: ['也就是他说话到底在不在当前的频道上？'], options: createPositiveAbilityOptions() },
  { id: 12, text: '能经常使用几个连贯的句子', clinical_intent: '评估复句及篇章叙述能力', colloquial: '他能连续说上好几句话，把一件小事给讲明白吗？', fallback_examples: ['比如讲讲今天在幼儿园吃了什么？'], options: createPositiveAbilityOptions() },
  { id: 13, text: '可以进行比较好的交谈', clinical_intent: '评估双向会话维持能力', colloquial: '您现在能跟他像普通人聊天那样，有来有回地聊上一会儿吗？', fallback_examples: ['而不是您问一句他答一句，然后天就聊死了？'], options: createPositiveAbilityOptions() },
  { id: 14, text: '有与他/她年龄相当的交流能力', clinical_intent: '评估整体语言发育与年龄匹配度', colloquial: '总体感觉下来，他的说话交流水平，跟同龄的小朋友差距大吗？', fallback_examples: ['是不是觉得他跟正常同龄孩子已经差不多了？'], options: createPositiveAbilityOptions() },

  // ================= 维度 II：社交能力 (15-34题) 计分：不符合(0), 有点符合(1), 非常符合(2) =================
  { id: 15, text: '像把自己关在贝壳里——你难以接触他/她', clinical_intent: '评估极度自闭与外界隔绝感', colloquial: '宝宝是不是经常像把自己关在小世界里，您很难走进他的心里？', fallback_examples: ['感觉像隔着一层玻璃一样？'], options: createNegativeSymptomOptions() },
  { id: 16, text: '忽视其他人', clinical_intent: '评估对社交对象的视觉与听觉忽视', colloquial: '他是不是经常对旁边的人视而不见，当别人不存在一样？', fallback_examples: ['别人走来走去他也不关心？'], options: createNegativeSymptomOptions() },
  { id: 17, text: '喊他时没有或很少有回应', clinical_intent: '评估名字呼唤的低反应率', colloquial: '您大声喊他名字，他是不是经常没反应或者很少理您？', fallback_examples: ['叫好几声都不抬头看一眼？'], options: createNegativeSymptomOptions() },
  { id: 18, text: '不合作，抵触', clinical_intent: '评估社交抗拒与不服从', colloquial: '让他干点啥，或者想带他玩，他是不是经常不配合，甚至很抵触？', fallback_examples: ['总是故意扭头或者走开？'], options: createNegativeSymptomOptions() },
  { id: 19, text: '没有目光交流', clinical_intent: '评估眼神对视的缺失', colloquial: '他是不是不看别人的眼睛，几乎没有眼神交流？', fallback_examples: ['就算看人也是飘忽不定，立刻躲开？'], options: createNegativeSymptomOptions() },
  { id: 20, text: '宁愿一个人待着', clinical_intent: '评估社交动机缺乏', colloquial: '他是不是比起跟人玩，更愿意一个人孤零零地待着？', fallback_examples: ['宁愿自己玩泥巴也不去凑热闹？'], options: createNegativeSymptomOptions() },
  { id: 21, text: '缺乏感情表现', clinical_intent: '评估情感淡漠', colloquial: '他看起来是不是冷冰冰的，很少表现出开心、难过这些丰富的感情？', fallback_examples: ['就像个没有情绪波动的小木头人？'], options: createNegativeSymptomOptions() },
  { id: 22, text: '看到父母无相应地反应', clinical_intent: '评估依恋行为与亲子互动缺失', colloquial: '您下班回家，他看到您是不是一点也不激动，没什么特别高兴的反应？', fallback_examples: ['不会跑过来要抱抱？'], options: createNegativeSymptomOptions() },
  { id: 23, text: '逃避与他人接触', clinical_intent: '评估主动的社交逃避', colloquial: '别人想去拉拉他的手、碰碰他，他是不是会有意躲开？', fallback_examples: ['很不喜欢和人靠近？'], options: createNegativeSymptomOptions() },
  { id: 24, text: '不模仿', clinical_intent: '评估社交模仿能力缺失', colloquial: '他是不是从来不跟着大人学做动作或者学说话？', fallback_examples: ['比如教他挥手、做鬼脸，他也不跟着学？'], options: createNegativeSymptomOptions() },
  { id: 25, text: '不喜欢被搂抱', clinical_intent: '评估身体亲密接触抗拒', colloquial: '您或者家里人想抱抱他，他是不是显得很不情愿，甚至会推开挣扎？', fallback_examples: ['不喜欢黏在大人身上？'], options: createNegativeSymptomOptions() },
  { id: 26, text: '不会分享或炫耀', clinical_intent: '评估共同注意与分享动机缺失', colloquial: '他拿到了好东西，或者画了张好看的画，是不是从来不会主动拿给您看、向您炫耀？', fallback_examples: ['总是自己一个人默默享受？'], options: createNegativeSymptomOptions() },
  { id: 27, text: '不会挥手表示“再见”', clinical_intent: '评估非言语社交礼仪缺失', colloquial: '别人走的时候，教他挥手说再见，他会挥手吗？', fallback_examples: ['是不是连最基础的挥手再见动作都不做？'], options: createNegativeSymptomOptions() },
  { id: 28, text: '不讨喜或不顺从', clinical_intent: '评估对立表现', colloquial: '他平时的表现是不是让人觉得很不顺从，或者有点不太讨人喜欢？', fallback_examples: ['经常让大人觉得很头疼？'], options: createNegativeSymptomOptions() },
  { id: 29, text: '容易发脾气', clinical_intent: '评估情绪易激惹', colloquial: '他是不是脾气很差，经常因为一点小事就发火哭闹？', fallback_examples: ['而且很难哄好？'], options: createNegativeSymptomOptions() },
  { id: 30, text: '缺乏朋友或玩伴', clinical_intent: '评估同伴关系建立困难', colloquial: '他身边是不是连个能玩到一块儿的固定小伙伴都没有？', fallback_examples: ['基本都是各玩各的？'], options: createNegativeSymptomOptions() },
  { id: 31, text: '很少笑', clinical_intent: '评估正面情绪表达缺失', colloquial: '他平时是不是很少露出开心的笑容，总是绷着一张小脸？', fallback_examples: ['逗他也很难让他笑出声？'], options: createNegativeSymptomOptions() },
  { id: 32, text: '对别人的感受不敏感', clinical_intent: '评估共情能力缺失', colloquial: '您或者别人伤心哭了，他是不是也无动于衷，感觉不到别人在难过？', fallback_examples: ['不知道要去安慰一下？'], options: createNegativeSymptomOptions() },
  { id: 33, text: '不在乎自己是否被喜欢', clinical_intent: '评估社交认同动机缺失', colloquial: '他是不是完全无所谓别人喜不喜欢他、夸不夸他？', fallback_examples: ['夸他他也不得意，骂他他也不在意？'], options: createNegativeSymptomOptions() },
  { id: 34, text: '对父母的离开无所谓', clinical_intent: '评估分离焦虑及安全依恋缺失', colloquial: '您出门上班或者把他留给别人，他是不是连看都不看，完全无所谓您走不走？', fallback_examples: ['一点舍不得的反应都没有？'], options: createNegativeSymptomOptions() },

  // ================= 维度 III：感知/认知能力 (35-52题) 计分：不符合(2), 有点符合(1), 非常符合(0) =================
  { id: 35, text: '对自己的名字有反应', clinical_intent: '评估名字知觉与自我意识', colloquial: '叫他名字的时候，他会有反应转头看您吗？', fallback_examples: ['就算手上在玩玩具，听到名字也会停一下吗？'], options: createPositiveAbilityOptions() },
  { id: 36, text: '对表扬有反应', clinical_intent: '评估对社交赞赏的敏感度', colloquial: '您夸他“宝宝真棒”，他会有开心或者得意的反应吗？', fallback_examples: ['能听懂别人在夸他吗？'], options: createPositiveAbilityOptions() },
  { id: 37, text: '喜欢看人和东西', clinical_intent: '评估主动视觉探索', colloquial: '他平时喜欢东张西望，去观察周围的人或者各种新东西吗？', fallback_examples: ['到了外面会不会好奇地到处看？'], options: createPositiveAbilityOptions() },
  { id: 38, text: '喜欢看图片(和电视）', clinical_intent: '评估对平面视觉媒体的兴趣', colloquial: '他平时喜欢看五颜六色的画本、卡片，或者看电视节目吗？', fallback_examples: ['能被图片里的内容吸引吗？'], options: createPositiveAbilityOptions() },
  { id: 39, text: '会画画、涂色和制作', clinical_intent: '评估精细运动及创作认知', colloquial: '他平时会拿着笔瞎画、涂颜色，或者做点简单的捏橡皮泥之类的手工吗？', fallback_examples: ['有这种想要创作的动作吗？'], options: createPositiveAbilityOptions() },
  { id: 40, text: '适当地玩玩具', clinical_intent: '评估功能性游戏能力', colloquial: '他拿到玩具会正常地玩吗？', fallback_examples: ['比如拿小汽车在地上推，而不是光咬轮子或者翻来覆去地排队？'], options: createPositiveAbilityOptions() },
  { id: 41, text: '有恰当的面部表情', clinical_intent: '评估非言语情感协调性', colloquial: '他脸上的表情自然丰富吗？高兴就笑，难过就撇嘴？', fallback_examples: ['不会总是木讷着脸吧？'], options: createPositiveAbilityOptions() },
  { id: 42, text: '能明白电视里讲的故事', clinical_intent: '评估多媒体内容的叙事理解', colloquial: '看动画片的时候，他能看懂里面讲的简单故事吗？', fallback_examples: ['还是只盯着里面变来变去的颜色看？'], options: createPositiveAbilityOptions() },
  { id: 43, text: '能明白解释', clinical_intent: '评估对日常事理逻辑的理解', colloquial: '您跟他解释个道理，比如“太烫了不能摸”，他能听明白意思吗？', fallback_examples: ['能理解简单的因果关系吗？'], options: createPositiveAbilityOptions() },
  { id: 44, text: '能意识到周围环境', clinical_intent: '评估环境感知能力', colloquial: '去到一个新地方，他会注意到周围的环境有什么不一样吗？', fallback_examples: ['不会像闭着眼睛走路一样完全忽视环境吧？'], options: createPositiveAbilityOptions() },
  { id: 45, text: '能意识到危险', clinical_intent: '评估自我保护与危险判断', colloquial: '到了马路边或者高的地方，他知道危险、会表现出害怕和退缩吗？', fallback_examples: ['是不是不知深浅，瞎往前冲？'], options: createPositiveAbilityOptions() },
  { id: 46, text: '表现出想象力', clinical_intent: '评估象征性游戏与认知灵活性', colloquial: '他玩游戏的时候有想象力吗？', fallback_examples: ['比如拿一根香蕉假装当电话打，或者给娃娃盖被子假装睡觉？'], options: createPositiveAbilityOptions() },
  { id: 47, text: '能自发的活动', clinical_intent: '评估行为发起的主动性', colloquial: '平时在家里，他会自己主动去找点事情做、找点东西玩吗？', fallback_examples: ['而不是非要大人去推着他、安排他干嘛才行？'], options: createPositiveAbilityOptions() },
  { id: 48, text: '能自己穿衣服', clinical_intent: '评估生活自理与运动规划', colloquial: '他现在能自己穿好简单的衣服或者裤子了吗？', fallback_examples: ['能掌握这种身体协调的动作吗？'], options: createPositiveAbilityOptions() },
  { id: 49, text: '表现出好奇和兴趣', clinical_intent: '评估认知求知欲', colloquial: '对于没见过的新鲜事物，他会表现出强烈的好奇心，想去研究一下吗？', fallback_examples: ['对新事物有探索的欲望吗？'], options: createPositiveAbilityOptions() },
  { id: 50, text: '会大胆的探究(新奇的东西）', clinical_intent: '评估探索行为的执行力', colloquial: '看到新奇的玩具或者东西，他敢不敢自己凑上去摸一摸、试一试？', fallback_examples: ['还是只敢看不敢碰？'], options: createPositiveAbilityOptions() },
  { id: 51, text: '能注意到周围环境并做出相应地反应，而不是与世隔绝', clinical_intent: '评估环境融合度', colloquial: '周围发生了什么事，他会去关注并且做出反应，而不是沉浸在自己的小世界里吗？', fallback_examples: ['比如外面突然下大雨了，他会好奇去看吗？'], options: createPositiveAbilityOptions() },
  { id: 52, text: '会循着别人看的地方看', clinical_intent: '评估共同注意(Joint Attention)', colloquial: '如果您突然盯着天上看或者看向窗外，他会顺着您的眼神一起看过去吗？', fallback_examples: ['能和您分享视觉焦点吗？'], options: createPositiveAbilityOptions() },

  // ================= 维度 IV：健康/生理/行为 (53-77题) 计分：不是问题(0), 小问题(1), 有点问题(2), 有严重问题(3) =================
  { id: 53, text: '尿床', clinical_intent: '评估夜间遗尿频率', colloquial: '他晚上睡觉还会尿床吗？这个情况严重吗？', fallback_examples: ['大概多久尿床一次？'], options: createBehaviorOptions() },
  { id: 54, text: '会弄湿裤子或尿布', clinical_intent: '评估日间排尿控制能力', colloquial: '白天醒着的时候，还会尿湿裤子，或者必须一直垫着尿不湿吗？', fallback_examples: ['自己懂得去马桶尿吗？'], options: createBehaviorOptions() },
  { id: 55, text: '(大便)会弄脏裤子或尿布', clinical_intent: '评估大便控制能力', colloquial: '白天会把大便拉在裤子上吗？', fallback_examples: ['这种不受控制的情况是个问题吗？'], options: createBehaviorOptions() },
  { id: 56, text: '腹泻', clinical_intent: '评估胃肠道异常（腹泻）', colloquial: '宝宝肠胃怎么样？经常拉肚子吗？', fallback_examples: ['大便经常不成形吗？'], options: createBehaviorOptions() },
  { id: 57, text: '便秘', clinical_intent: '评估胃肠道异常（便秘）', colloquial: '他平时排便顺畅吗？会有便秘、好几天不拉粑粑的问题吗？', fallback_examples: ['便秘严重吗？'], options: createBehaviorOptions() },
  { id: 58, text: '睡眠有问题', clinical_intent: '评估睡眠障碍', colloquial: '晚上睡觉安稳吗？会不会入睡困难，或者半夜经常醒？', fallback_examples: ['睡眠质量是个大问题吗？'], options: createBehaviorOptions() },
  { id: 59, text: '吃得太多/太少', clinical_intent: '评估进食量异常', colloquial: '他饭量正常吗？会不会吃得特别撑不知道停，或者吃得极少？', fallback_examples: ['食量方面让您发愁吗？'], options: createBehaviorOptions() },
  { id: 60, text: '极端挑食', clinical_intent: '评估饮食刻板与狭隘', colloquial: '他吃饭挑食的程度严重吗？', fallback_examples: ['比如是不是只吃白米饭，或者只吃某种特定形状、颜色的食物？'], options: createBehaviorOptions() },
  { id: 61, text: '多动', clinical_intent: '评估活动量亢进', colloquial: '他平时是不是活动量特别大，像装了小马达一样一刻也停不下来？', fallback_examples: ['到处跑跳，极度好动？'], options: createBehaviorOptions() },
  { id: 62, text: '无精打采', clinical_intent: '评估精神活力低下', colloquial: '他会不会经常显得蔫蔫的、懒洋洋的，对什么都没兴致？', fallback_examples: ['就像没睡醒一样？'], options: createBehaviorOptions() },
  { id: 63, text: '自己打自己或自伤', clinical_intent: '评估自伤行为(SIB)', colloquial: '他发脾气或者着急的时候，会打自己的头、咬自己的手，甚至弄伤自己吗？', fallback_examples: ['有自残的倾向吗？'], options: createBehaviorOptions() },
  { id: 64, text: '打别人或伤害别人', clinical_intent: '评估攻击性与冲动行为', colloquial: '他会不会经常动手打别的孩子或者大人？', fallback_examples: ['脾气上来控制不住去伤人？'], options: createBehaviorOptions() },
  { id: 65, text: '具有破坏性', clinical_intent: '评估破坏环境及物品行为', colloquial: '他平时搞破坏多吗？比如故意摔烂东西、撕坏家里的书本？', fallback_examples: ['是个破坏王吗？'], options: createBehaviorOptions() },
  { id: 66, text: '对声音过敏', clinical_intent: '评估听觉高敏与防御', colloquial: '他对某些特定的声音（比如吹风机、电钻声）会不会特别敏感害怕？', fallback_examples: ['甚至会捂住耳朵大叫？'], options: createBehaviorOptions() },
  { id: 67, text: '焦虑/害怕', clinical_intent: '评估基础焦虑水平', colloquial: '他是不是经常看起来很紧张、很害怕，充满焦虑感？', fallback_examples: ['经常无缘无故地恐慌？'], options: createBehaviorOptions() },
  { id: 68, text: '不快乐/哭闹', clinical_intent: '评估负面情绪与情绪调节障碍', colloquial: '他是不是经常不开心，动不动就大发脾气、一直哭闹？', fallback_examples: ['非常难哄？'], options: createBehaviorOptions() },
  { id: 69, text: '抽搐', clinical_intent: '评估神经系统异常征象', colloquial: '他以前或者现在有过抽搐、翻白眼或者类似癫痫发作的情况吗？', fallback_examples: ['这是一个健康大问题吗？'], options: createBehaviorOptions() },
  { id: 70, text: '强迫性的说话', clinical_intent: '评估言语强迫症与刻板语言', colloquial: '他会不会像被按了开关一样，没完没了地、强迫性地重复说某些话？', fallback_examples: ['完全不管别人听不听？'], options: createBehaviorOptions() },
  { id: 71, text: '机械、刻板', clinical_intent: '评估行为刻板性', colloquial: '他做事情是不是非常死板机械？', fallback_examples: ['比如玩具必须摆成一条直线，路线必须固定？'], options: createBehaviorOptions() },
  { id: 72, text: '大喊或尖叫', clinical_intent: '评估异常的情绪发泄', colloquial: '他会不会经常毫无预兆地大喊大叫、发出尖锐刺耳的声音？', fallback_examples: ['激动的时候喜欢尖叫？'], options: createBehaviorOptions() },
  { id: 73, text: '要求以同样的方式从事活动', clinical_intent: '评估对同一性的强迫坚持', colloquial: '他是不是强迫一切事情都要按照他固定的步骤来做？', fallback_examples: ['稍微改变一点程序就会受不了崩溃？'], options: createBehaviorOptions() },
  { id: 74, text: '经常表现出不安', clinical_intent: '评估精神运动性不安', colloquial: '他是不是经常坐立难安，显得很急躁或者心神不宁？', fallback_examples: ['感觉像热锅上的蚂蚁？'], options: createBehaviorOptions() },
  { id: 75, text: '对疼痛不敏感', clinical_intent: '评估痛觉迟钝', colloquial: '他摔了一跤或者磕碰到了，是不是好像感觉不到疼，甚至都不哭？', fallback_examples: ['痛觉好像很不敏感？'], options: createBehaviorOptions() },
  { id: 76, text: '容易成瘾或沉迷于一些事物或话题', clinical_intent: '评估局限狭隘的兴趣', colloquial: '他是不是会对某样特定的东西（比如转车轮、某段视频）沉迷到无法自拔的地步？', fallback_examples: ['完全打断不了他的沉迷？'], options: createBehaviorOptions() },
  { id: 77, text: '重复性动作（如： 自我刺激行为、摇摆等）', clinical_intent: '评估刻板重复运动', colloquial: '他平时会不会反复做一些奇怪的动作？比如摇晃身体、来回踱步、或者拍手？', fallback_examples: ['这种自我刺激的动作多吗？'], options: createBehaviorOptions() }
];

const ATEC_DIMENSIONS = [
  {
    id: 'language',
    label: '表达 / 语言沟通',
    questionIds: Array.from({ length: 14 }, (_, index) => index + 1),
    maxScore: 28,
  },
  {
    id: 'social',
    label: '社交能力',
    questionIds: Array.from({ length: 20 }, (_, index) => index + 15),
    maxScore: 40,
  },
  {
    id: 'sensory_cognitive',
    label: '感知 / 认知能力',
    questionIds: Array.from({ length: 18 }, (_, index) => index + 35),
    maxScore: 36,
  },
  {
    id: 'health_behavior',
    label: '健康 / 生理 / 行为',
    questionIds: Array.from({ length: 25 }, (_, index) => index + 53),
    maxScore: 75,
  },
] as const;

function buildDimensionDetails(answers: number[]) {
  return ATEC_DIMENSIONS.reduce<Record<string, { label: string; score: number; maxScore: number; questionIds: number[] }>>((result, dimension) => {
    const score = dimension.questionIds.reduce((sum, questionId) => {
      const answer = answers[questionId - 1];
      return sum + (typeof answer === 'number' && Number.isFinite(answer) ? answer : 0);
    }, 0);

    result[dimension.id] = {
      label: dimension.label,
      score,
      maxScore: dimension.maxScore,
      questionIds: [...dimension.questionIds],
    };

    return result;
  }, {});
}

export const ATEC_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "ATEC",
  version: "1.0",
  title: {
    zh: "孤独症治疗评估量表 (ATEC)",
    en: "Autism Treatment Evaluation Checklist (ATEC)",
  },
  description: {
    zh: "用于评估孤独症儿童的症状严重程度及追踪干预治疗效果。包含语言、社交、感知觉和行为四大维度。总分越高，代表症状越严重。",
    en: "Used to assess autism-related symptom severity and track intervention outcomes across language, social, sensory-cognitive, and behavior domains.",
  } satisfies LocalizedTextValue,
  category: "Child Development",
  tags: ["自闭症", "孤独症", "干预追踪", "疗效评估"],
  interactionMode: "voice_guided",
  resultDeliveryMode: "physician_review",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: true,
  questions: ATEC_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    const safeAnswers = answers.length === 77 ? answers : [...answers, ...Array(77 - answers.length).fill(0)];
    const dimensions = buildDimensionDetails(safeAnswers);
    const languageScore = dimensions.language.score;
    const socialScore = dimensions.social.score;
    const cognitiveScore = dimensions.sensory_cognitive.score;
    const behaviorScore = dimensions.health_behavior.score;
    const totalScore = languageScore + socialScore + cognitiveScore + behaviorScore;

    let conclusion: string;
    let description = `【表达 / 语言沟通】${languageScore}/28\n【社交能力】${socialScore}/40\n【感知 / 认知能力】${cognitiveScore}/36\n【健康 / 生理 / 行为】${behaviorScore}/75\n\n`;

    if (totalScore >= 104) {
      conclusion = "重度症状特征";
      description += "临床建议：当前表现出较为严重的孤独症特征。建议维持高密度的专业干预治疗，并可将此分数作为基线，每3-6个月重测一次，以量化观察康复效果。";
    } else if (totalScore >= 50) {
      conclusion = "中度症状特征";
      description += "临床建议：存在中等程度的孤独症相关挑战。请重点关注各维度得分最高的部分，针对性地加强语言或社交的家庭干预训练。";
    } else if (totalScore >= 30) {
      conclusion = "轻度/临界状态";
      description += "临床建议：表现出轻度或临界的症状。如果孩子正在接受干预，这是一个积极的信号；建议继续保持当前的训练节奏。";
    } else {
      conclusion = "基本正常/干预良好";
      description += "临床建议：得分为优良区间（低于30分）。孩子在语言、社交和行为方面的困难较少，整体发展状态或治疗康复效果非常理想。";
    }

    return {
      totalScore,
      conclusion,
      details: {
        scoreLabel: "ATEC 总分",
        scoreDisplay: `${totalScore} / 179`,
        totalScoreLabel: "原始总分",
        totalScoreHint: "分数越高，代表症状越明显。",
        dimensions,
        description,
      }
    };
  }
};
