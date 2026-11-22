نسخة النشر السحابي - Event Initiatives

تم تجهيز المشروع لاستخدام PostgreSQL عبر Npgsql بدل SQL Server، وتخزين الملفات في Supabase Storage الخاص (Bucket: event-media)، مع Docker وRender Blueprint.

إعدادات Render المطلوبة (Environment Variables):
1) ConnectionStrings__DefaultConnection = سلسلة PostgreSQL بصيغة Npgsql: Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
2) Supabase__Url = عنوان المشروع مثل https://PROJECT.supabase.co
3) Supabase__ServiceRoleKey = مفتاح service_role من Supabase (سري جدًا، يوضع في Render فقط ولا يشارك مع المستخدمين).
4) Supabase__Bucket = event-media
5) BootstrapAdmin__Email و BootstrapAdmin__Password = بيانات المدير الأول. استخدم كلمة مرور قوية.

تنبيه: تأكد أن Bucket event-media موجود وPrivate. لا تستخدم event-mediaa العام. لا تضع مفاتيح Supabase السرية داخل appsettings.json أو GitHub.

ملاحظة التهيئة: يستخدم التطبيق EnsureCreatedAsync لإنشاء الجداول في قاعدة جديدة. لا تستخدمه مع قاعدة تحتوي جداول موجودة مسبقًا؛ في هذه الحالة يلزم إعداد EF Core migrations قبل النشر.

لا تتضمن هذه الحزمة مفاتيح اتصال أو كلمات مرور. يجب ضبطها في إعدادات Render.
