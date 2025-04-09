import { View, Text, Image } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-expo'

export default function Header() {
    const { user } = useUser();
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        if (user) {
            setUserData({
                lastName: user.lastName,
                imageUrl: user.imageUrl
            });
        }
    }, [user]);

    return (
        <View style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <View>
                <Text style={{
                    fontFamily: 'outfit',
                    fontSize: 18
                }}>Welcome,</Text>
                <Text style={{
                    fontFamily: 'outfit-medium',
                    fontSize: 25
                }}>{userData?.lastName}</Text>
            </View>
            <Image source={{ uri: userData?.imageUrl }}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 99
                }}
            />
        </View>
    )
}