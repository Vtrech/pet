import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { addDoc, collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/FirebaseConfig'
import { useUser } from '@clerk/clerk-expo'
import moment from 'moment'

export default function ChatScreen() {
  const params = useLocalSearchParams()
  const navigation = useNavigation()
  const { user } = useUser()
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const flatListRef = useRef(null)

  useEffect(() => {
    GetUserDetails()

    const unsubscribe = onSnapshot(collection(db, 'Chat', params?.id, 'Messages'), (snapshot) => {
      const messageData = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data()
      }))
      const sorted = messageData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      const withSeparators = insertDateSeparators(sorted)
      setMessages(withSeparators)
    })

    return () => unsubscribe()
  }, [])

  const GetUserDetails = async () => {
    const docRef = doc(db, 'Chat', params?.id)
    const docSnap = await getDoc(docRef)
    const result = docSnap.data()
    const otherUser = result?.users.filter(item => item.email !== user?.primaryEmailAddress?.emailAddress)
    navigation.setOptions({
      headerTitle: otherUser?.[0]?.name
    })
  }

  const onSend = async () => {
    if (inputText.trim() === '') return

    const newMessage = {
      _id: Date.now().toString(),
      text: inputText,
      createdAt: new Date().toISOString(),
      user: {
        _id: user?.primaryEmailAddress?.emailAddress,
        name: user?.fullName,
        avatar: user?.imageUrl
      }
    }

    setMessages(prev => [...prev, newMessage])
    setInputText('')
    await addDoc(collection(db, 'Chat', params?.id, 'Messages'), newMessage)
  }

  const insertDateSeparators = (msgs) => {
    const result = []
    let lastDate = null
    msgs.forEach((msg) => {
      const msgDate = moment(msg.createdAt).format('YYYY-MM-DD')
      if (msgDate !== lastDate) {
        result.push({
          _id: 'separator-' + msgDate,
          type: 'separator',
          date: msgDate
        })
        lastDate = msgDate
      }
      result.push(msg)
    })
    return result
  }

  const renderItem = ({ item, index }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.separator}>
          <Text style={styles.separatorText}>{moment(item.date).format('MMM D, YYYY')}</Text>
        </View>
      )
    }

    const isMyMessage = item.user?._id === user?.primaryEmailAddress?.emailAddress
    const showAvatar =
      index === messages.length - 1 ||
      (messages[index + 1]?.user?._id !== item.user?._id &&
        messages[index + 1]?.type !== 'separator')

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
    )
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
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={onSend} style={styles.sendButton}>
          <Text style={{ color: 'white' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4'
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  textInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#fff'
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    justifyContent: 'center'
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 10
  },
  myWrapper: {
    justifyContent: 'flex-end'
  },
  theirWrapper: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '70%'
  },
  myMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 0
  },
  theirMessage: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 0
  },
  messageText: {
    color: '#fff',
    fontSize: 16
  },
  timeText: {
    color: '#f0f0f0',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right'
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: 5
  },
  separator: {
    alignItems: 'center',
    marginVertical: 10
  },
  separatorText: {
    color: '#999',
    fontSize: 12,
    backgroundColor: '#e1e1e1',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10
  }
})
