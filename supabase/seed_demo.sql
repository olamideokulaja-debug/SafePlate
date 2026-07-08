-- SafePlate demo data seed. Run in the Supabase SQL editor AFTER schema.sql and schema_hardened.sql.
-- Run ONCE. Most tables skip duplicates, but audit/notification/release rows would duplicate if re-run. See the DELETE block at the bottom to reset.
-- The SQL editor bypasses RLS, so these inserts always apply.

alter table certificates add column if not exists cert_no text;
alter table certificates add column if not exists photo text;
alter table food_handlers add column if not exists lga text;
alter table businesses add column if not exists owner_uid uuid;

insert into laboratories (id,name,area,accredited,acc_no) values
  ('lancet-ikeja','Lancet Ikeja','Ikeja',true,'HEF-LAB-0142'),
  ('synlab-vi','Synlab Victoria Island','Victoria Island',true,'HEF-LAB-0088'),
  ('clinix-surulere','Clinix Surulere','Surulere',true,'HEF-LAB-0210'),
  ('medbury-yaba','Medbury Yaba','Yaba',true,'HEF-LAB-0175'),
  ('zaine-lekki','Zaine Diagnostics Lekki','Lekki',false,null)
on conflict (id) do nothing;

insert into food_handlers (safeplate_id,name,phone,lga,employer,created_at) values
  ('SP-LG-2026001001','Adewale Adeyemi','08031000000','Ikeja','Mama Cass Kitchen', now() - interval '2 days'),
  ('SP-LG-2026001002','Bola Eze','08031007919','Eti-Osa','Sweet Sensation', now() - interval '3 days'),
  ('SP-LG-2026001003','Kemi Ogundipe','08031015838','Surulere','Grill House', now() - interval '4 days'),
  ('SP-LG-2026001004','Ngozi Adebayo','08031023757','Alimosho','The Place', now() - interval '5 days'),
  ('SP-LG-2026001005','Chidinma Ojo','08031031676','Kosofe','Chicken Republic', now() - interval '6 days'),
  ('SP-LG-2026001006','Emeka Akinola','08031039595','Mushin','Ofada Heaven', now() - interval '7 days'),
  ('SP-LG-2026001007','Folake Sani','08031047514','Oshodi-Isolo','Buka Express', now() - interval '8 days'),
  ('SP-LG-2026001008','Tunde Ekwueme','08031055433','Yaba','Yellow Chilli', now() - interval '9 days'),
  ('SP-LG-2026001009','Halima Chukwu','08031158380','Ikeja','Mama Cass Kitchen', now() - interval '22 days'),
  ('SP-LG-2026001010','Femi Umeh','08031166299','Eti-Osa','Sweet Sensation', now() - interval '23 days'),
  ('SP-LG-2026001011','Sola Danladi','08031174218','Surulere','Grill House', now() - interval '24 days'),
  ('SP-LG-2026001012','Chinedu Ayodele','08031182137','Alimosho','The Place', now() - interval '25 days'),
  ('SP-LG-2026001013','Temitope Adeniyi','08031190056','Kosofe','Chicken Republic', now() - interval '26 days'),
  ('SP-LG-2026001014','Aisha Adeyemi','08031197975','Mushin','Ofada Heaven', now() - interval '27 days'),
  ('SP-LG-2026001015','Chidinma Mohammed','08031316760','Ikeja','Mama Cass Kitchen', now() - interval '42 days'),
  ('SP-LG-2026001016','Emeka Uzoma','08031324679','Eti-Osa','Sweet Sensation', now() - interval '43 days'),
  ('SP-LG-2026001017','Folake Oladele','08031332598','Surulere','Grill House', now() - interval '44 days'),
  ('SP-LG-2026001018','Tunde Balogun','08031340517','Alimosho','The Place', now() - interval '45 days'),
  ('SP-LG-2026001019','Temitope Bello','08031475140','Ikeja','Mama Cass Kitchen', now() - interval '62 days'),
  ('SP-LG-2026001020','Aisha Nwosu','08031483059','Eti-Osa','Sweet Sensation', now() - interval '63 days'),
  ('SP-LG-2026001021','Gbenga Yusuf','08031490978','Surulere','Grill House', now() - interval '64 days'),
  ('SP-LG-2026001022','Nneka Lawal','08031498897','Alimosho','The Place', now() - interval '65 days'),
  ('SP-LG-2026001023','Ibrahim Obi','08031506816','Kosofe','Chicken Republic', now() - interval '66 days'),
  ('SP-LG-2026001024','Blessing Mohammed','08031514735','Mushin','Ofada Heaven', now() - interval '67 days'),
  ('SP-LG-2026001025','Fatima Uzoma','08031522654','Oshodi-Isolo','Buka Express', now() - interval '68 days'),
  ('SP-LG-2026001026','Efe Oladele','08031530573','Yaba','Yellow Chilli', now() - interval '69 days'),
  ('SP-LG-2026001027','Suleiman Balogun','08031538492','Ikorodu','Cactus Restaurant', now() - interval '70 days'),
  ('SP-LG-2026001028','Grace Ibrahim','08031546411','Lagos Mainland','Terra Kulture Cafe', now() - interval '71 days'),
  ('SP-LG-2026001029','Kayode Chukwu','08031554330','Ikeja','Mama Cass Kitchen', now() - interval '72 days'),
  ('SP-LG-2026001030','Yusuf Umeh','08031562249','Eti-Osa','Sweet Sensation', now() - interval '73 days'),
  ('SP-LG-2026001031','Yewande Akinola','08031633520','Ikeja','Mama Cass Kitchen', now() - interval '82 days'),
  ('SP-LG-2026001032','Ifeoma Sani','08031641439','Eti-Osa','Sweet Sensation', now() - interval '83 days'),
  ('SP-LG-2026001033','Segun Ekwueme','08031649358','Surulere','Grill House', now() - interval '84 days'),
  ('SP-LG-2026001034','Ronke Mohammed','08031712710','Ikeja','Mama Cass Kitchen', now() - interval '92 days'),
  ('SP-LG-2026001035','Obinna Uzoma','08031720629','Eti-Osa','Sweet Sensation', now() - interval '93 days'),
  ('SP-LG-2026001036','Halima Oladele','08031728548','Surulere','Grill House', now() - interval '94 days'),
  ('SP-LG-2025001037','Ibrahim Adeyemi','08031791900','Ikeja','Mama Cass Kitchen', now() - interval '102 days'),
  ('SP-LG-2025001038','Blessing Eze','08031799819','Eti-Osa','Sweet Sensation', now() - interval '103 days'),
  ('SP-LG-2025001039','Fatima Ogundipe','08031807738','Surulere','Grill House', now() - interval '104 days'),
  ('SP-LG-2025001040','Efe Adebayo','08031815657','Alimosho','The Place', now() - interval '105 days'),
  ('SP-LG-2025001041','Suleiman Ojo','08031823576','Kosofe','Chicken Republic', now() - interval '106 days'),
  ('SP-LG-2026001042','Kemi Bello','08031871090','Ikeja','Mama Cass Kitchen', now() - interval '112 days'),
  ('SP-LG-2026001043','Ngozi Nwosu','08031879009','Eti-Osa','Sweet Sensation', now() - interval '113 days'),
  ('SP-LG-2026001044','Chidinma Yusuf','08031886928','Surulere','Grill House', now() - interval '114 days')
on conflict do nothing;

insert into test_orders (id,safeplate_id,handler_name,phone,lab,tests,status,results,created_at,submitted_at) values
  ('ORD-2026-001001','SP-LG-2026001001','Adewale Adeyemi','08031000000','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '1 days', now() - interval '1 days'),
  ('ORD-2026-001002','SP-LG-2026001002','Bola Eze','08031007919','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '2 days', now() - interval '2 days'),
  ('ORD-2026-001003','SP-LG-2026001003','Kemi Ogundipe','08031015838','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '3 days', now() - interval '3 days'),
  ('ORD-2026-001004','SP-LG-2026001004','Ngozi Adebayo','08031023757','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '1 days', now() - interval '1 days'),
  ('ORD-2026-001005','SP-LG-2026001005','Chidinma Ojo','08031031676','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '2 days', now() - interval '2 days'),
  ('ORD-2026-001006','SP-LG-2026001006','Emeka Akinola','08031039595','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '3 days', now() - interval '3 days'),
  ('ORD-2026-001007','SP-LG-2026001007','Folake Sani','08031047514','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '1 days', now() - interval '1 days'),
  ('ORD-2026-001008','SP-LG-2026001008','Tunde Ekwueme','08031055433','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Submitted','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"pass"}'::jsonb, now() - interval '2 days', now() - interval '2 days'),
  ('ORD-2026-001009','SP-LG-2026001009','Halima Chukwu','08031158380','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Scheduled',null, now() - interval '1 days', null),
  ('ORD-2026-001010','SP-LG-2026001010','Femi Umeh','08031166299','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Sample Collected',null, now() - interval '2 days', null),
  ('ORD-2026-001011','SP-LG-2026001011','Sola Danladi','08031174218','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Testing in Progress',null, now() - interval '3 days', null),
  ('ORD-2026-001012','SP-LG-2026001012','Chinedu Ayodele','08031182137','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Scheduled',null, now() - interval '4 days', null),
  ('ORD-2026-001013','SP-LG-2026001013','Temitope Adeniyi','08031190056','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Sample Collected',null, now() - interval '5 days', null),
  ('ORD-2026-001014','SP-LG-2026001014','Aisha Adeyemi','08031197975','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Testing in Progress',null, now() - interval '6 days', null),
  ('ORD-2026-001015','SP-LG-2026001015','Chidinma Mohammed','08031316760','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '3 days', now() - interval '0 days'),
  ('ORD-2026-001016','SP-LG-2026001016','Emeka Uzoma','08031324679','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '4 days', now() - interval '1 days'),
  ('ORD-2026-001017','SP-LG-2026001017','Folake Oladele','08031332598','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '5 days', now() - interval '2 days'),
  ('ORD-2026-001018','SP-LG-2026001018','Tunde Balogun','08031340517','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '6 days', now() - interval '3 days'),
  ('ORD-2026-001019','SP-LG-2026001019','Temitope Bello','08031475140','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '20 days', now() - interval '20 days'),
  ('ORD-2026-001020','SP-LG-2026001020','Aisha Nwosu','08031483059','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '25 days', now() - interval '25 days'),
  ('ORD-2026-001021','SP-LG-2026001021','Gbenga Yusuf','08031490978','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '30 days', now() - interval '30 days'),
  ('ORD-2026-001022','SP-LG-2026001022','Nneka Lawal','08031498897','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '35 days', now() - interval '35 days'),
  ('ORD-2026-001023','SP-LG-2026001023','Ibrahim Obi','08031506816','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '40 days', now() - interval '40 days'),
  ('ORD-2026-001024','SP-LG-2026001024','Blessing Mohammed','08031514735','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '45 days', now() - interval '45 days'),
  ('ORD-2026-001025','SP-LG-2026001025','Fatima Uzoma','08031522654','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '50 days', now() - interval '50 days'),
  ('ORD-2026-001026','SP-LG-2026001026','Efe Oladele','08031530573','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '55 days', now() - interval '55 days'),
  ('ORD-2026-001027','SP-LG-2026001027','Suleiman Balogun','08031538492','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '60 days', now() - interval '60 days'),
  ('ORD-2026-001028','SP-LG-2026001028','Grace Ibrahim','08031546411','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '65 days', now() - interval '65 days'),
  ('ORD-2026-001029','SP-LG-2026001029','Kayode Chukwu','08031554330','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '70 days', now() - interval '70 days'),
  ('ORD-2026-001030','SP-LG-2026001030','Yusuf Umeh','08031562249','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Approved',null, now() - interval '75 days', now() - interval '75 days'),
  ('ORD-2026-001031','SP-LG-2026001031','Yewande Akinola','08031633520','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Flagged','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '2 days', now() - interval '2 days'),
  ('ORD-2026-001032','SP-LG-2026001032','Ifeoma Sani','08031641439','Synlab Victoria Island','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Flagged','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '3 days', now() - interval '3 days'),
  ('ORD-2026-001033','SP-LG-2026001033','Segun Ekwueme','08031649358','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Flagged','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '4 days', now() - interval '4 days'),
  ('ORD-2026-001034','SP-LG-2026001034','Ronke Mohammed','08031712710','Clinix Surulere','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Rejected','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '5 days', now() - interval '5 days'),
  ('ORD-2026-001035','SP-LG-2026001035','Obinna Uzoma','08031720629','Medbury Yaba','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Rejected','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '6 days', now() - interval '6 days'),
  ('ORD-2026-001036','SP-LG-2026001036','Halima Oladele','08031728548','Lancet Ikeja','["Hepatitis A","Hepatitis E","Stool Microscopy & Culture (MC)"]'::jsonb,'Rejected','{"Hepatitis A":"pass","Hepatitis E":"pass","Stool Microscopy & Culture (MC)":"refer"}'::jsonb, now() - interval '7 days', now() - interval '7 days')
on conflict do nothing;

insert into certificates (safeplate_id,name,panel,lab,issued,expiry,status,cert_no) values
  ('SP-LG-2026001015','Chidinma Mohammed','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '0 days', now() + interval '182 days','VALID','LSH-2026-000115'),
  ('SP-LG-2026001016','Emeka Uzoma','Hepatitis A, Hepatitis E, Stool MC','Synlab Victoria Island', now() - interval '1 days', now() + interval '181 days','VALID','LSH-2026-000116'),
  ('SP-LG-2026001017','Folake Oladele','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '2 days', now() + interval '180 days','VALID','LSH-2026-000117'),
  ('SP-LG-2026001018','Tunde Balogun','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '3 days', now() + interval '179 days','VALID','LSH-2026-000118'),
  ('SP-LG-2026001019','Temitope Bello','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '20 days', now() + interval '162 days','VALID','LSH-2026-000219'),
  ('SP-LG-2026001020','Aisha Nwosu','Hepatitis A, Hepatitis E, Stool MC','Synlab Victoria Island', now() - interval '25 days', now() + interval '157 days','VALID','LSH-2026-000220'),
  ('SP-LG-2026001021','Gbenga Yusuf','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '30 days', now() + interval '152 days','VALID','LSH-2026-000221'),
  ('SP-LG-2026001022','Nneka Lawal','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '35 days', now() + interval '147 days','VALID','LSH-2026-000222'),
  ('SP-LG-2026001023','Ibrahim Obi','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '40 days', now() + interval '142 days','VALID','LSH-2026-000223'),
  ('SP-LG-2026001024','Blessing Mohammed','Hepatitis A, Hepatitis E, Stool MC','Synlab Victoria Island', now() - interval '45 days', now() + interval '137 days','VALID','LSH-2026-000224'),
  ('SP-LG-2026001025','Fatima Uzoma','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '50 days', now() + interval '132 days','VALID','LSH-2026-000225'),
  ('SP-LG-2026001026','Efe Oladele','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '55 days', now() + interval '127 days','VALID','LSH-2026-000226'),
  ('SP-LG-2026001027','Suleiman Balogun','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '60 days', now() + interval '122 days','VALID','LSH-2026-000227'),
  ('SP-LG-2026001028','Grace Ibrahim','Hepatitis A, Hepatitis E, Stool MC','Synlab Victoria Island', now() - interval '65 days', now() + interval '117 days','VALID','LSH-2026-000228'),
  ('SP-LG-2026001029','Kayode Chukwu','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '70 days', now() + interval '112 days','VALID','LSH-2026-000229'),
  ('SP-LG-2026001030','Yusuf Umeh','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '75 days', now() + interval '107 days','VALID','LSH-2026-000230'),
  ('SP-LG-2025001037','Ibrahim Adeyemi','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '200 days', now() - interval '18 days','EXPIRED','LSH-2025-000337'),
  ('SP-LG-2025001038','Blessing Eze','Hepatitis A, Hepatitis E, Stool MC','Synlab Victoria Island', now() - interval '205 days', now() - interval '23 days','EXPIRED','LSH-2025-000338'),
  ('SP-LG-2025001039','Fatima Ogundipe','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '210 days', now() - interval '28 days','EXPIRED','LSH-2025-000339'),
  ('SP-LG-2025001040','Efe Adebayo','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '215 days', now() - interval '33 days','EXPIRED','LSH-2025-000340'),
  ('SP-LG-2025001041','Suleiman Ojo','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '220 days', now() - interval '38 days','EXPIRED','LSH-2025-000341'),
  ('SP-LG-2026001042','Kemi Bello','Hepatitis A, Hepatitis E, Stool MC','Clinix Surulere', now() - interval '30 days', now() + interval '150 days','REVOKED','LSH-2026-000442'),
  ('SP-LG-2026001043','Ngozi Nwosu','Hepatitis A, Hepatitis E, Stool MC','Medbury Yaba', now() - interval '35 days', now() + interval '150 days','REVOKED','LSH-2026-000443'),
  ('SP-LG-2026001044','Chidinma Yusuf','Hepatitis A, Hepatitis E, Stool MC','Lancet Ikeja', now() - interval '40 days', now() + interval '150 days','REVOKED','LSH-2026-000444'),
  ('SP-W-LG-2026003001','Ocean Basket, VI','Potable water quality','Synlab Victoria Island', now() - interval '1 days', now() + interval '182 days','VALID','SP-W-CERT-2026-000501'),
  ('SP-W-LG-2026003002','Kada Plaza Eatery','Potable water quality','Clinix Surulere', now() - interval '2 days', now() + interval '182 days','VALID','SP-W-CERT-2026-000502'),
  ('SP-W-LG-2026003005','ICM Foodcourt','Potable water quality','Synlab Victoria Island', now() - interval '5 days', now() + interval '182 days','VALID','SP-W-CERT-2026-000505')
on conflict do nothing;

insert into escrow (safeplate_id,name,lab,amount,type,status,ts,released_ts,released_by) values
  ('SP-LG-2026001001','Adewale Adeyemi','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '1 days',null,null),
  ('SP-LG-2026001002','Bola Eze','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '2 days',null,null),
  ('SP-LG-2026001003','Kemi Ogundipe','Clinix Surulere',15000,'FOOD','HELD', now() - interval '3 days',null,null),
  ('SP-LG-2026001004','Ngozi Adebayo','Medbury Yaba',15000,'FOOD','HELD', now() - interval '1 days',null,null),
  ('SP-LG-2026001005','Chidinma Ojo','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '2 days',null,null),
  ('SP-LG-2026001006','Emeka Akinola','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '3 days',null,null),
  ('SP-LG-2026001007','Folake Sani','Clinix Surulere',15000,'FOOD','HELD', now() - interval '1 days',null,null),
  ('SP-LG-2026001008','Tunde Ekwueme','Medbury Yaba',15000,'FOOD','HELD', now() - interval '2 days',null,null),
  ('SP-LG-2026001009','Halima Chukwu','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '1 days',null,null),
  ('SP-LG-2026001010','Femi Umeh','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '2 days',null,null),
  ('SP-LG-2026001011','Sola Danladi','Clinix Surulere',15000,'FOOD','HELD', now() - interval '3 days',null,null),
  ('SP-LG-2026001012','Chinedu Ayodele','Medbury Yaba',15000,'FOOD','HELD', now() - interval '4 days',null,null),
  ('SP-LG-2026001013','Temitope Adeniyi','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '5 days',null,null),
  ('SP-LG-2026001014','Aisha Adeyemi','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '6 days',null,null),
  ('SP-LG-2026001015','Chidinma Mohammed','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '3 days',null,null),
  ('SP-LG-2026001016','Emeka Uzoma','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '4 days',null,null),
  ('SP-LG-2026001017','Folake Oladele','Clinix Surulere',15000,'FOOD','HELD', now() - interval '5 days',null,null),
  ('SP-LG-2026001018','Tunde Balogun','Medbury Yaba',15000,'FOOD','HELD', now() - interval '6 days',null,null),
  ('SP-LG-2026001019','Temitope Bello','Lancet Ikeja',15000,'FOOD','RELEASED', now() - interval '20 days', now() - interval '18 days','Sterling Bank Officer'),
  ('SP-LG-2026001020','Aisha Nwosu','Synlab Victoria Island',15000,'FOOD','RELEASED', now() - interval '25 days', now() - interval '23 days','Sterling Bank Officer'),
  ('SP-LG-2026001021','Gbenga Yusuf','Clinix Surulere',15000,'FOOD','RELEASED', now() - interval '30 days', now() - interval '28 days','Sterling Bank Officer'),
  ('SP-LG-2026001022','Nneka Lawal','Medbury Yaba',15000,'FOOD','RELEASED', now() - interval '35 days', now() - interval '33 days','Sterling Bank Officer'),
  ('SP-LG-2026001023','Ibrahim Obi','Lancet Ikeja',15000,'FOOD','RELEASED', now() - interval '40 days', now() - interval '38 days','Sterling Bank Officer'),
  ('SP-LG-2026001024','Blessing Mohammed','Synlab Victoria Island',15000,'FOOD','RELEASED', now() - interval '45 days', now() - interval '43 days','Sterling Bank Officer'),
  ('SP-LG-2026001025','Fatima Uzoma','Clinix Surulere',15000,'FOOD','RELEASED', now() - interval '50 days', now() - interval '48 days','Sterling Bank Officer'),
  ('SP-LG-2026001026','Efe Oladele','Medbury Yaba',15000,'FOOD','RELEASED', now() - interval '55 days', now() - interval '53 days','Sterling Bank Officer'),
  ('SP-LG-2026001027','Suleiman Balogun','Lancet Ikeja',15000,'FOOD','RELEASED', now() - interval '60 days', now() - interval '58 days','Sterling Bank Officer'),
  ('SP-LG-2026001028','Grace Ibrahim','Synlab Victoria Island',15000,'FOOD','RELEASED', now() - interval '65 days', now() - interval '63 days','Sterling Bank Officer'),
  ('SP-LG-2026001029','Kayode Chukwu','Clinix Surulere',15000,'FOOD','RELEASED', now() - interval '70 days', now() - interval '68 days','Sterling Bank Officer'),
  ('SP-LG-2026001030','Yusuf Umeh','Medbury Yaba',15000,'FOOD','RELEASED', now() - interval '75 days', now() - interval '73 days','Sterling Bank Officer'),
  ('SP-LG-2026001031','Yewande Akinola','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '2 days',null,null),
  ('SP-LG-2026001032','Ifeoma Sani','Synlab Victoria Island',15000,'FOOD','HELD', now() - interval '3 days',null,null),
  ('SP-LG-2026001033','Segun Ekwueme','Clinix Surulere',15000,'FOOD','HELD', now() - interval '4 days',null,null),
  ('SP-LG-2026001034','Ronke Mohammed','Clinix Surulere',15000,'FOOD','HELD', now() - interval '5 days',null,null),
  ('SP-LG-2026001035','Obinna Uzoma','Medbury Yaba',15000,'FOOD','HELD', now() - interval '6 days',null,null),
  ('SP-LG-2026001036','Halima Oladele','Lancet Ikeja',15000,'FOOD','HELD', now() - interval '7 days',null,null),
  ('SP-W-LG-2026003000','Grill House, Lekki','Lancet Ikeja',65000,'WATER','HELD', now() - interval '2 days',null,null),
  ('SP-W-LG-2026003001','Ocean Basket, VI','Synlab Victoria Island',65000,'WATER','RELEASED', now() - interval '3 days', now() - interval '1 days','Sterling Bank Officer'),
  ('SP-W-LG-2026003002','Kada Plaza Eatery','Clinix Surulere',65000,'WATER','RELEASED', now() - interval '4 days', now() - interval '2 days','Sterling Bank Officer'),
  ('SP-W-LG-2026003003','RForRabbit Cafe','Medbury Yaba',65000,'WATER','HELD', now() - interval '5 days',null,null),
  ('SP-W-LG-2026003004','Blue Cabana','Lancet Ikeja',65000,'WATER','HELD', now() - interval '6 days',null,null),
  ('SP-W-LG-2026003005','ICM Foodcourt','Synlab Victoria Island',65000,'WATER','RELEASED', now() - interval '7 days', now() - interval '5 days','Sterling Bank Officer'),
  ('SP-W-LG-2026003006','Debonair Lounge','Clinix Surulere',65000,'WATER','HELD', now() - interval '8 days',null,null),
  ('SP-W-LG-2026003007','Yellow Chilli Ikeja','Medbury Yaba',65000,'WATER','HELD', now() - interval '9 days',null,null)
on conflict do nothing;

insert into escrow_releases (safeplate_id,name,lab,amount,status,approved_by,ts) values
  ('SP-LG-2026001015','Chidinma Mohammed','Lancet Ikeja',15000,'Instructed','LSMoH Officer', now() - interval '0 days'),
  ('SP-LG-2026001016','Emeka Uzoma','Synlab Victoria Island',15000,'Instructed','LSMoH Officer', now() - interval '1 days'),
  ('SP-LG-2026001017','Folake Oladele','Clinix Surulere',15000,'Instructed','LSMoH Officer', now() - interval '2 days'),
  ('SP-LG-2026001018','Tunde Balogun','Medbury Yaba',15000,'Instructed','LSMoH Officer', now() - interval '3 days'),
  ('SP-LG-2026001019','Temitope Bello','Lancet Ikeja',15000,'Released','LSMoH Officer', now() - interval '19 days'),
  ('SP-LG-2026001020','Aisha Nwosu','Synlab Victoria Island',15000,'Released','LSMoH Officer', now() - interval '24 days'),
  ('SP-LG-2026001021','Gbenga Yusuf','Clinix Surulere',15000,'Released','LSMoH Officer', now() - interval '29 days'),
  ('SP-LG-2026001022','Nneka Lawal','Medbury Yaba',15000,'Released','LSMoH Officer', now() - interval '34 days'),
  ('SP-LG-2026001023','Ibrahim Obi','Lancet Ikeja',15000,'Released','LSMoH Officer', now() - interval '39 days'),
  ('SP-LG-2026001024','Blessing Mohammed','Synlab Victoria Island',15000,'Released','LSMoH Officer', now() - interval '44 days'),
  ('SP-LG-2026001025','Fatima Uzoma','Clinix Surulere',15000,'Released','LSMoH Officer', now() - interval '49 days'),
  ('SP-LG-2026001026','Efe Oladele','Medbury Yaba',15000,'Released','LSMoH Officer', now() - interval '54 days'),
  ('SP-LG-2026001027','Suleiman Balogun','Lancet Ikeja',15000,'Released','LSMoH Officer', now() - interval '59 days'),
  ('SP-LG-2026001028','Grace Ibrahim','Synlab Victoria Island',15000,'Released','LSMoH Officer', now() - interval '64 days'),
  ('SP-LG-2026001029','Kayode Chukwu','Clinix Surulere',15000,'Released','LSMoH Officer', now() - interval '69 days'),
  ('SP-LG-2026001030','Yusuf Umeh','Medbury Yaba',15000,'Released','LSMoH Officer', now() - interval '74 days'),
  ('SP-W-LG-2026003001','Ocean Basket, VI','Synlab Victoria Island',65000,'Released','LASEPA Officer', now() - interval '1 days'),
  ('SP-W-LG-2026003002','Kada Plaza Eatery','Clinix Surulere',65000,'Released','LASEPA Officer', now() - interval '2 days'),
  ('SP-W-LG-2026003005','ICM Foodcourt','Synlab Victoria Island',65000,'Released','LASEPA Officer', now() - interval '5 days')
;

insert into water_tests (swid,facility,lga,source,officer,contact,lab,amount,status,results,cert_series,owner_email,ts) values
  ('SP-W-LG-2026003000','Grill House, Lekki','Eti-Osa','Borehole','Adewale Okonkwo','0803330000','Lancet Ikeja',65000,'Submitted, pending LASEPA','{"ph":"6.8","turbidity":"1.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,null,'seed', now() - interval '2 days'),
  ('SP-W-LG-2026003001','Ocean Basket, VI','Eti-Osa','Public mains','Bola Adeyemi','0803330111','Synlab Victoria Island',65000,'Certified','{"ph":"6.9","turbidity":"2.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,'SP-W-CERT-2026-000501','seed', now() - interval '3 days'),
  ('SP-W-LG-2026003002','Kada Plaza Eatery','Ikeja','Water vendor','Kemi Oladele','0803330222','Clinix Surulere',65000,'Certified','{"ph":"7.0","turbidity":"3.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,'SP-W-CERT-2026-000502','seed', now() - interval '4 days'),
  ('SP-W-LG-2026003003','RForRabbit Cafe','Surulere','Borehole','Ngozi Okafor','0803330333','Medbury Yaba',65000,'Flagged, retest required','{"ph":"7.1","turbidity":"4.2 NTU","ecoli":"5 CFU/100ml"}'::jsonb,null,'seed', now() - interval '5 days'),
  ('SP-W-LG-2026003004','Blue Cabana','Eti-Osa','Public mains','Chidinma Eze','0803330444','Lancet Ikeja',65000,'Submitted, pending LASEPA','{"ph":"7.2","turbidity":"1.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,null,'seed', now() - interval '6 days'),
  ('SP-W-LG-2026003005','ICM Foodcourt','Ikeja','Water vendor','Emeka Balogun','0803330555','Synlab Victoria Island',65000,'Certified','{"ph":"6.8","turbidity":"2.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,'SP-W-CERT-2026-000505','seed', now() - interval '7 days'),
  ('SP-W-LG-2026003006','Debonair Lounge','Yaba','Borehole','Folake Bello','0803330666','Clinix Surulere',65000,'Flagged, retest required','{"ph":"6.9","turbidity":"3.2 NTU","ecoli":"8 CFU/100ml"}'::jsonb,null,'seed', now() - interval '8 days'),
  ('SP-W-LG-2026003007','Yellow Chilli Ikeja','Ikeja','Public mains','Tunde Ogundipe','0803330777','Medbury Yaba',65000,'Submitted, pending LASEPA','{"ph":"7.0","turbidity":"4.2 NTU","ecoli":"0 CFU/100ml"}'::jsonb,null,'seed', now() - interval '9 days')
on conflict do nothing;

insert into establishments (id,name,lga,compliance,sanction,appeal) values
  ('EST-001','Mama Cass Kitchen, Ikeja','Ikeja','Compliant',null,null),
  ('EST-002','Sweet Sensation, Yaba','Yaba','Overdue','Warning',null),
  ('EST-003','Grill House, Lekki','Eti-Osa','Non-compliant','Fine',null),
  ('EST-004','Buka Express, Surulere','Surulere','Compliant',null,null),
  ('EST-005','Ofada Heaven, Ikorodu','Ikorodu','Overdue','Warning',null),
  ('EST-006','Cactus, VI','Eti-Osa','Compliant',null,null),
  ('EST-007','The Place, Lekki','Eti-Osa','Non-compliant','Suspension','Under appeal'),
  ('EST-008','Yellow Chilli, Ikeja','Ikeja','Compliant',null,null)
on conflict do nothing;

insert into audit_log (actor,role,action,subject,ts,ip) values
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2026001016', now() - interval '5 days' - interval '4 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2026001019', now() - interval '6 days' - interval '20 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2026001022', now() - interval '0 days' - interval '2 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2026001025', now() - interval '13 days' - interval '17 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-LG-2026001028', now() - interval '1 days' - interval '11 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-LG-2025001037', now() - interval '9 days' - interval '1 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-LG-2025001040', now() - interval '8 days' - interval '6 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-LG-2026001043', now() - interval '0 days' - interval '2 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-W-LG-2026003002', now() - interval '6 days' - interval '13 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2026001016', now() - interval '1 days' - interval '7 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2026001019', now() - interval '1 days' - interval '17 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2026001022', now() - interval '6 days' - interval '1 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2026001025', now() - interval '13 days' - interval '18 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2026001028', now() - interval '1 days' - interval '7 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-LG-2025001037', now() - interval '10 days' - interval '20 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-LG-2025001040', now() - interval '9 days' - interval '1 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-LG-2026001043', now() - interval '9 days' - interval '18 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-W-LG-2026003002', now() - interval '6 days' - interval '1 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-LG-2026001016', now() - interval '3 days' - interval '1 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2026001019', now() - interval '8 days' - interval '4 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2026001022', now() - interval '4 days' - interval '13 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2026001025', now() - interval '2 days' - interval '17 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2026001028', now() - interval '1 days' - interval '18 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2025001037', now() - interval '4 days' - interval '17 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-LG-2025001040', now() - interval '13 days' - interval '21 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-LG-2026001043', now() - interval '2 days' - interval '3 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-W-LG-2026003002', now() - interval '9 days' - interval '18 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-LG-2026001016', now() - interval '10 days' - interval '6 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-LG-2026001019', now() - interval '5 days' - interval '3 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2026001022', now() - interval '8 days' - interval '22 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2026001025', now() - interval '1 days' - interval '18 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2026001028', now() - interval '0 days' - interval '19 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2025001037', now() - interval '3 days' - interval '15 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2025001040', now() - interval '10 days' - interval '17 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-LG-2026001043', now() - interval '6 days' - interval '10 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-W-LG-2026003002', now() - interval '7 days' - interval '18 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-LG-2026001016', now() - interval '7 days' - interval '11 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-LG-2026001019', now() - interval '4 days' - interval '7 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-LG-2026001022', now() - interval '12 days' - interval '5 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2026001025', now() - interval '11 days' - interval '7 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2026001028', now() - interval '1 days' - interval '18 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2025001037', now() - interval '4 days' - interval '16 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2025001040', now() - interval '7 days' - interval '10 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2026001043', now() - interval '11 days' - interval '14 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-W-LG-2026003002', now() - interval '4 days' - interval '19 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-LG-2026001016', now() - interval '1 days' - interval '3 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-LG-2026001019', now() - interval '8 days' - interval '13 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-LG-2026001022', now() - interval '2 days' - interval '10 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-LG-2026001025', now() - interval '2 days' - interval '15 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2026001028', now() - interval '6 days' - interval '1 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2025001037', now() - interval '10 days' - interval '2 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2025001040', now() - interval '12 days' - interval '17 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-LG-2026001043', now() - interval '9 days' - interval '10 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-W-LG-2026003002', now() - interval '5 days' - interval '22 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Certificate revoked','SP-LG-2026001016', now() - interval '5 days' - interval '19 hours','captured server-side'),
  ('public','public','Certificate verified via portal','SP-LG-2026001019', now() - interval '7 days' - interval '18 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Signed in','SP-LG-2026001022', now() - interval '12 days' - interval '14 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Water approved, certificate issued','SP-LG-2026001025', now() - interval '1 days' - interval '2 hours','captured server-side'),
  ('Mrs Ojo, HEFAMAA','HEFAMAA','Accreditation status updated','SP-LG-2026001028', now() - interval '4 days' - interval '15 hours','captured server-side'),
  ('Engr Musa, LASEPA','LASEPA','Sanction applied: Warning','SP-LG-2025001037', now() - interval '11 days' - interval '21 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Approved, certificate issued, escrow release instructed','SP-LG-2025001040', now() - interval '1 days' - interval '1 hours','captured server-side'),
  ('Sterling Bank Officer','Sterling Bank','Escrow released, full waterfall disbursed','SP-LG-2026001043', now() - interval '11 days' - interval '22 hours','captured server-side'),
  ('Lancet Ikeja Tech','laboratory','Results submitted (encrypted)','SP-W-LG-2026003002', now() - interval '4 days' - interval '20 hours','captured server-side'),
  ('Dr Ada Bello, LSMoH','LSMoH','Flagged for review, escrow held','SP-LG-2026001016', now() - interval '9 days' - interval '21 hours','captured server-side')
;

insert into notifications (audience,title,body,ts) values
  ('all','SafePlate is live','Statewide food handler and water certification is now active.', now() - interval '1 day'),
  ('LSMoH','Results awaiting review','8 laboratory results are pending Ministry approval.', now() - interval '2 hours'),
  ('sterling','Releases pending','4 approved releases await execution.', now() - interval '5 hours'),
  ('LASEPA','Water results','3 facilities are pending LASEPA review.', now() - interval '8 hours')
;

insert into businesses (owner_email,name,lga,staff) values
  ('employer@demo.ng','Grill House Group','Eti-Osa','[{"id":"S1","name":"Adaeze Nwosu","phone":"08031110001","status":"Certified"},{"id":"S2","name":"Bode Adekunle","phone":"08031110002","status":"Certified"},{"id":"S3","name":"Chika Obi","phone":"08031110003","status":"Pending results"},{"id":"S4","name":"Dami Lawal","phone":"08031110004","status":"Pending results"},{"id":"S5","name":"Ejiro Efe","phone":"08031110005","status":"Overdue"},{"id":"S6","name":"Femi Sanni","phone":"08031110006","status":"Not registered"},{"id":"S7","name":"Grace Uche","phone":"08031110007","status":"Not registered"}]'::jsonb)
on conflict (owner_email) do nothing;

-- OPTIONAL: after creating an Employer account with email employer@demo.ng, run this so the
-- hardened RLS lets that account see the demo team:
-- update businesses set owner_uid = (select id from auth.users where email = 'employer@demo.ng') where owner_email = 'employer@demo.ng';

-- ---- To remove all demo data later ----
-- delete from test_orders where safeplate_id like 'SP-LG-%'; delete from certificates where safeplate_id like 'SP-%';
-- delete from escrow where safeplate_id like 'SP-%'; delete from escrow_releases where safeplate_id like 'SP-%';
-- delete from water_tests where owner_email='seed'; delete from food_handlers where safeplate_id like 'SP-LG-%';
-- delete from establishments where id like 'EST-%'; delete from audit_log where ip='captured server-side';
