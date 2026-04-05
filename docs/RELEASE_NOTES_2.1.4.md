# Release Notes - v2.1.4

Tarih: 2026-04-05

## Odak

Bu surum, arama stabilitesi, Selcuk/Nevzat fiyat geri donusleri ve aktif siparis plani duzenleme deneyimini toparlamak icin cikartildi.

## Degisiklikler

- Normal arama akisi legacy prosedure geri alinip depo bazli toplama yeniden sabitlendi.
- Selcuk ve Nevzat aramalarinda stale session durumlari icin yeniden login + retry davranisi eklendi.
- Selcuk, Nevzat ve Alliance fiyat alma mantiklari canli quote helper'lariyla temizlendi; net alanlar dogru sekilde normalize edildi.
- Arama hata durumlari ve sonsuz loading senaryolari sertlestirildi.
- Aktif siparis plani kartlari icin sagdan acilan plan duzenleyici eklendi.
- Plan kartlarinda hizli aksiyonlar geri getirildi: adet azalt/artir, depoya git ve sil.
- Ayarlar, tanilama ve UI stabilite katmaninda birden fazla koruma iyilestirmesi yapildi.
- Auth verileri ve hassas data dosyalari `.gitignore` kapsaminda sertlestirildi.

## Hedeflenen Sonuc

- Kullanici ana arama akisini tekrar guvenilir sekilde kullanabilir.
- Selcuk ve Nevzat teklifleri yeniden gorunur ve canli fiyatlariyla gelir.
- Aktif plan ekraninda hem hizli kart aksiyonlari hem de detayli sag panel duzenleme birlikte calisir.
