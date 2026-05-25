# CrypGo Mobile

Мобилно приложение за градски превози с Bitcoin Lightning Network плащания.

## Технологии
- **Framework:** React Native (TypeScript)
- **Платформи:** iOS + Android
- **Блокчейн:** Bitcoin Lightning Network (Breez SDK)
- **Карти:** OpenStreetMap (react-native-maps)
- **Комуникация:** WebSockets (Socket.io client)
- **Навигация:** React Navigation

## Роли
- **Пътник (Passenger):** заявява курс, плаща чрез Lightning, следи шофьора в реално време
- **Шофьор (Driver):** приема поръчки, стриймва GPS локация, получава Lightning плащания

## Начало
```bash
npm install
npx expo start
```
