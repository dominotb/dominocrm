export const campaigns=[
{id:'c1',name:'Tủ bếp - Xây nhà T10',status:'Đang chạy',spend:3260000,messages:72,leads:24,qualified:16,cpl:135833},
{id:'c2',name:'Cải tạo bếp T10',status:'Đang chạy',spend:2110000,messages:43,leads:12,qualified:7,cpl:175833},
{id:'c3',name:'Remarketing Showroom',status:'Tạm dừng',spend:1350000,messages:23,leads:6,qualified:3,cpl:225000},
];
export const daily=[
{day:'26/09',spend:720000,messages:16,leads:4},{day:'27/09',spend:860000,messages:19,leads:6},{day:'28/09',spend:790000,messages:17,leads:5},{day:'29/09',spend:1080000,messages:24,leads:7},{day:'30/09',spend:930000,messages:20,leads:6},{day:'01/10',spend:1140000,messages:25,leads:8},{day:'02/10',spend:1200000,messages:27,leads:6},
];
export const fmt=(n:number)=>new Intl.NumberFormat('vi-VN').format(n)+' ₫';
