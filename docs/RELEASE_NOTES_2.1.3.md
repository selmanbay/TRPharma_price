# Release Notes - v2.1.3

Tarih: 2026-04-03

## Odak

Bu surum 2.1.2 sonrasinda toplu siparis ve varsayilan teklif secimi davranisini daha guvenilir hale getirmek icin cikartildi.

## Degisiklikler

- Arama ve toplu liste ekraninda varsayilan secim deterministik hale getirildi.
- Ilk acilista `en uygun` teklif otomatik seciliyor; esit fiyatlarda depo adi ile sabit siralama kullaniliyor.
- Bulk listeden plana ekleme akisinda kaynak urun/depo bilgisi, son normal arama state'ine degil kartin kendi secimine gore yaziliyor.
- Bulk plan toplaminda secili teklifin canli/toplam fiyat bilgisi korunuyor.

## Hedeflenen Sonuc

- Kullanici ilk acilista random secim gormez.
- Bulk listeden `Plana Ekle` ve `Hepsini Ekle` dogru depo, dogru barkod ve dogru toplam ile plan kaydi olusturur.
