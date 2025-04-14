import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Image,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { addDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/FirebaseConfig'; // Điều chỉnh đường dẫn
import { useUser } from '@clerk/clerk-expo';
import moment from 'moment';

export default function ChatScreen() {
    const params = useLocalSearchParams();
    const navigation = useNavigation();
    const { user } = useUser();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef(null);

    const GEMINI_API_KEY = 'AIzaSyDAPOBmI_b7vM3cYrCeuAm2pK4AHTLy5rw'; // Thay bằng API key từ Google Cloud
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    useEffect(() => {
        // Đặt tiêu đề header là "Bác sĩ thú y"
        navigation.setOptions({
            headerTitle: 'Bác sĩ thú y',
        });

        if (!user) return;

        // Tải tin nhắn từ Firestore theo userId
        const userId = user.id;
        const messagesRef = collection(db, 'chatMessages', userId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messageData = snapshot.docs.map((doc) => ({
                _id: doc.id,
                ...doc.data(),
            }));
            const sorted = messageData.sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
            const withSeparators = insertDateSeparators(sorted);
            setMessages(withSeparators);
        }, (error) => {
            console.error('Error loading messages from Firestore:', error);
        });

        return () => unsubscribe();
    }, [user]);

    const onSend = async () => {
        if (inputText.trim() === '' || !user) return;

        const userId = user.id;

        // Thêm tin nhắn người dùng vào Firestore
        const newMessage = {
            _id: Date.now().toString(),
            text: inputText,
            createdAt: new Date().toISOString(),
            user: {
                _id: user?.primaryEmailAddress?.emailAddress,
                name: user?.fullName,
                avatar: user?.imageUrl,
            },
        };

        try {
            await addDoc(collection(db, 'chatMessages', userId, 'messages'), newMessage);
        } catch (error) {
            console.error('Error saving user message to Firestore:', error);
            return;
        }

        setInputText('');

        // Gọi API Gemini để chatbot trả lời
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: inputText,
                                },
                            ],
                        },
                    ],
                    systemInstruction: {
                        parts: [
                            {
                                text: 'Bạn là một bác sĩ thú y chuyên nghiệp, hãy trả lời bằng tiếng Việt một cách chi tiết, dễ hiểu và hữu ích. Cung cấp lời khuyên về chăm sóc sức khỏe động vật, chẩn đoán sơ bộ các triệu chứng (nếu có), và khuyến nghị cách xử lý. Nếu tình trạng nghiêm trọng, hãy khuyên người dùng đưa thú cưng đến bác sĩ thú y ngay lập tức. Đừng đưa ra chẩn đoán chính thức hoặc kê đơn thuốc, vì bạn không phải bác sĩ thú y thực sự.',
                            },
                        ],
                    },
                    generationConfig: {
                        maxOutputTokens: 150,
                        temperature: 0.7,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`
                );
            }

            const data = await response.json();
            const botMessageText = data.candidates[0]?.content?.parts[0]?.text || 'Không có phản hồi từ API.';

            // Lưu tin nhắn bot vào Firestore
            const botMessage = {
                _id: (Date.now() + 1).toString(),
                text: botMessageText,
                createdAt: new Date().toISOString(),
                user: {
                    _id: 'chatbot',
                    name: 'Bác sĩ thú y',
                    avatar: null, // Không cần avatar cho chatbot
                },
            };

            await addDoc(collection(db, 'chatMessages', userId, 'messages'), botMessage);
        } catch (error) {
            console.error('Error:', error.message);
            const errorMessage = {
                _id: (Date.now() + 1).toString(),
                text: `Lỗi: ${error.message}`,
                createdAt: new Date().toISOString(),
                user: {
                    _id: 'chatbot',
                    name: 'Bác sĩ thú y',
                    avatar: null,
                },
            };
            await addDoc(collection(db, 'chatMessages', userId, 'messages'), errorMessage);
        }
    };

    const insertDateSeparators = (msgs) => {
        const result = [];
        let lastDate = null;
        msgs.forEach((msg) => {
            const msgDate = moment(msg.createdAt).format('YYYY-MM-DD');
            if (msgDate !== lastDate) {
                result.push({
                    _id: 'separator-' + msgDate,
                    type: 'separator',
                    date: msgDate,
                });
                lastDate = msgDate;
            }
            result.push(msg);
        });
        return result;
    };

    const renderItem = ({ item, index }) => {
        if (item.type === 'separator') {
            return (
                <View style={styles.separator}>
                    <Text style={styles.separatorText}>{moment(item.date).format('MMM D, YYYY')}</Text>
                </View>
            );
        }

        const isMyMessage = item.user?._id === user?.primaryEmailAddress?.emailAddress;
        const showAvatar =
            index === messages.length - 1 ||
            (messages[index + 1]?.user?._id !== item.user?._id &&
                messages[index + 1]?.type !== 'separator');

        return (
            <View style={[styles.messageWrapper, isMyMessage ? styles.myWrapper : styles.theirWrapper]}>
                <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
                    <Text style={[styles.messageText, !isMyMessage && { color: '#000' }]}>{item.text}</Text>
                    <Text style={styles.timeText}>{moment(item.createdAt).format('h:mm A')}</Text>
                </View>
                {showAvatar && isMyMessage && (
                    <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                )}
            </View>
        );
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text>Đang tải thông tin người dùng...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 10 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Hỏi bác sĩ thú y..."
                    value={inputText}
                    onChangeText={setInputText}
                />
                <TouchableOpacity onPress={onSend} style={styles.sendButton}>
                    <Text style={{ color: 'white' }}>Gửi</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f4f4',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fff',
    },
    textInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 20,
        paddingHorizontal: 15,
        backgroundColor: '#fff',
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#007AFF',
        borderRadius: 20,
        paddingHorizontal: 15,
        justifyContent: 'center',
    },
    messageWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 4,
        paddingHorizontal: 10,
    },
    myWrapper: {
        justifyContent: 'flex-end',
    },
    theirWrapper: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        padding: 10,
        borderRadius: 15,
        maxWidth: '70%',
    },
    myMessage: {
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 0,
    },
    theirMessage: {
        backgroundColor: '#E5E5EA',
        borderBottomLeftRadius: 0,
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
    },
    timeText: {
        color: '#f0f0f0',
        fontSize: 11,
        marginTop: 4,
        textAlign: 'right',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginLeft: 5,
    },
    separator: {
        alignItems: 'center',
        marginVertical: 10,
    },
    separatorText: {
        color: '#999',
        fontSize: 12,
        backgroundColor: '#e1e1e1',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
});